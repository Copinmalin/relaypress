import { workerConfig } from "../config.js";
import { decryptSecret } from "../crypto.js";
import { pool } from "../db.js";
import type { ClaimedPublicationJob, PublicationPublisher, PublicationPublishResult } from "./types.js";
import { PublisherPublishError } from "./types.js";

const REQUIRED_SCOPE = "pages_manage_posts";
const PAGE_URN_PREFIX = "urn:facebook:page:";

type DatabaseFacebookAccount = {
  id: string;
  provider: string;
  account_urn: string;
  display_name: string | null;
  status: string;
  encrypted_access_token: string;
  token_expires_at: Date | null;
  scopes: string[];
};

type FacebookPublisherOptions = {
  allowedJobId?: string;
};

type FacebookGraphError = {
  error?: {
    message?: unknown;
    type?: unknown;
    code?: unknown;
    error_subcode?: unknown;
    fbtrace_id?: unknown;
  };
};

function requireFacebookPlatform(job: ClaimedPublicationJob): void {
  if (job.platform !== "facebook") {
    throw new Error(`Facebook publisher cannot publish platform: ${job.platform}`);
  }
}

function requireAllowedJob(job: ClaimedPublicationJob, allowedJobId: string | undefined): void {
  if (!allowedJobId || job.id !== allowedJobId) {
    throw new Error("Facebook publisher rejected a job outside the explicit allowlist");
  }
}

function requireContent(job: ClaimedPublicationJob): string {
  const content = job.adapted_content?.trim();

  if (!content) {
    throw new Error("Facebook publisher cannot publish empty content");
  }

  return content;
}

function extractPageId(accountUrn: string): string {
  if (!accountUrn.startsWith(PAGE_URN_PREFIX)) {
    throw new Error("Facebook publisher account URN must be a page URN");
  }

  const pageId = accountUrn.slice(PAGE_URN_PREFIX.length).trim();
  if (!pageId) throw new Error("Facebook page URN is missing the page id");
  return pageId;
}

function sanitizeFacebookPayload(payload: unknown): Record<string, unknown> {
  if (typeof payload === "string") {
    return { message: payload.slice(0, 1_000) };
  }

  if (!payload || typeof payload !== "object") {
    return { message: "Unknown Facebook response" };
  }

  const record = payload as FacebookGraphError;
  const error = record.error;

  return {
    message: typeof error?.message === "string" ? error.message.slice(0, 1_000) : undefined,
    type: error?.type,
    code: error?.code,
    errorSubcode: error?.error_subcode,
    traceId: error?.fbtrace_id,
  };
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

async function findConfiguredFacebookAccount(): Promise<DatabaseFacebookAccount | null> {
  if (!workerConfig.facebookPublisherAccountId) return null;

  const result = await pool.query<DatabaseFacebookAccount>(
    `
      select
        id,
        provider,
        account_urn,
        display_name,
        status,
        encrypted_access_token,
        token_expires_at,
        scopes
      from publisher_accounts
      where id = $1
      limit 1
    `,
    [workerConfig.facebookPublisherAccountId],
  );

  return result.rows[0] ?? null;
}

async function markAccountStatus(accountId: string, status: string): Promise<void> {
  await pool.query(
    `
      update publisher_accounts
      set status = $2, last_validated_at = now(), updated_at = now()
      where id = $1
    `,
    [accountId, status],
  );
}

async function loadFacebookAccount(): Promise<DatabaseFacebookAccount | null> {
  const account = await findConfiguredFacebookAccount();
  if (!account) return null;

  if (account.provider !== "facebook") {
    throw new Error("Configured publisher account is not a Facebook account");
  }

  if (account.status !== "connected") {
    throw new Error(`Configured Facebook account is not connected: ${account.status}`);
  }

  if (!account.scopes.includes(REQUIRED_SCOPE)) {
    throw new Error(`Facebook account is missing required scope: ${REQUIRED_SCOPE}`);
  }

  if (account.token_expires_at && account.token_expires_at.getTime() <= Date.now()) {
    await markAccountStatus(account.id, "expired");
    return null;
  }

  return account;
}

async function probeFacebookPage(account: DatabaseFacebookAccount): Promise<void> {
  const pageId = extractPageId(account.account_urn);
  const url = new URL(`${workerConfig.metaGraphApiBaseUrl}/${pageId}`);
  url.searchParams.set("fields", "id,name");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${decryptSecret(account.encrypted_access_token)}`,
    },
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await markAccountStatus(account.id, "invalid");
    }

    const safePayload = sanitizeFacebookPayload(payload);
    const message = typeof safePayload.message === "string" ? safePayload.message : response.statusText;
    throw new Error(`Facebook page check failed ${response.status}: ${message}`);
  }

  const returnedPageId = typeof (payload as { id?: unknown }).id === "string" ? (payload as { id: string }).id : null;
  if (returnedPageId !== pageId) {
    await markAccountStatus(account.id, "invalid");
    throw new Error("Facebook page check did not match configured page id");
  }

  await markAccountStatus(account.id, "connected");
}

function extractFacebookPostId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

async function publishFacebookPost(
  job: ClaimedPublicationJob,
  allowedJobId: string | undefined,
  validatedAccount: DatabaseFacebookAccount | null,
): Promise<PublicationPublishResult> {
  requireFacebookPlatform(job);
  requireAllowedJob(job, allowedJobId);

  const account = validatedAccount ?? await loadFacebookAccount();
  if (!account) {
    throw new Error("Facebook publisher account is not configured or has expired");
  }

  if (!validatedAccount) {
    await probeFacebookPage(account);
  }

  const content = requireContent(job);
  const pageId = extractPageId(account.account_urn);
  const url = `${workerConfig.metaGraphApiBaseUrl}/${pageId}/feed`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${decryptSecret(account.encrypted_access_token)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: content }),
  });
  const responsePayload = await readResponsePayload(response);

  if (!response.ok) {
    const errorPayload = sanitizeFacebookPayload(responsePayload);
    const message = `Facebook API error ${response.status}: ${
      typeof errorPayload.message === "string" ? errorPayload.message : response.statusText
    }`;

    throw new PublisherPublishError(message, {
      ok: false,
      provider: "facebook",
      endpoint: "/feed",
      status: response.status,
      statusText: response.statusText,
      error: errorPayload,
      contentLength: content.length,
      accountId: account.id,
      accountUrn: account.account_urn,
    });
  }

  const providerPostId = extractFacebookPostId(responsePayload);
  if (!providerPostId) {
    throw new PublisherPublishError("Facebook response did not include a post id", {
      ok: false,
      provider: "facebook",
      endpoint: "/feed",
      status: response.status,
      contentLength: content.length,
      accountId: account.id,
      accountUrn: account.account_urn,
      postMayHaveBeenCreated: true,
    });
  }

  const externalPostId = `facebook:${providerPostId}`;

  return {
    externalPostId,
    rawResponse: {
      ok: true,
      provider: "facebook",
      endpoint: "/feed",
      status: response.status,
      externalPostId,
      providerPostId,
      contentLength: content.length,
      accountId: account.id,
      accountUrn: account.account_urn,
      pageId,
    },
  };
}

export function createFacebookPublisher(options: FacebookPublisherOptions = {}): PublicationPublisher {
  let validatedAccount: DatabaseFacebookAccount | null = null;

  return {
    platform: "facebook",
    mode: "real",
    component: "facebook-publisher",
    maxJobsPerTick: 1,
    allowedJobId: options.allowedJobId,
    isReady: async () => {
      try {
        if (!options.allowedJobId) {
          return { ready: false, reason: "Facebook allowed job ID is not configured" };
        }

        const account = await loadFacebookAccount();
        if (!account) {
          return { ready: false, reason: "Facebook publisher account is not configured or has expired" };
        }

        await probeFacebookPage(account);
        validatedAccount = account;
        return { ready: true };
      } catch (error) {
        validatedAccount = null;
        const message = error instanceof Error ? error.message : String(error);
        return { ready: false, reason: message };
      }
    },
    publish: async (job) => publishFacebookPost(job, options.allowedJobId, validatedAccount),
  };
}
