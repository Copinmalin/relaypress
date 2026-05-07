import { workerConfig } from "../config.js";
import { decryptSecret, encryptSecret } from "../crypto.js";
import { pool } from "../db.js";
import type { ClaimedPublicationJob, PublicationPublisher, PublicationPublishResult } from "./types.js";
import { PublisherPublishError } from "./types.js";

const LINKEDIN_UGC_POSTS_PATH = "/ugcPosts";
const LINKEDIN_TOKEN_PATH = "/oauth/v2/accessToken";
const LINKEDIN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type LinkedInErrorResponse = {
  message?: unknown;
  serviceErrorCode?: unknown;
  status?: unknown;
  code?: unknown;
};

type LinkedInTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  refresh_token_expires_in?: unknown;
  scope?: unknown;
};

type DatabaseLinkedInAccount = {
  id: string;
  account_urn: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: Date | null;
  refresh_token_expires_at: Date | null;
  scopes: string[];
};

type LinkedInCredentials = {
  source: "publisher_accounts" | "env";
  authorUrn: string;
  accessToken: string;
  accountId?: string;
  refreshed?: boolean;
};

let cachedCredentials: LinkedInCredentials | null = null;

function requireLinkedInPlatform(job: ClaimedPublicationJob): void {
  if (job.platform !== "linkedin") {
    throw new Error(`LinkedIn publisher cannot publish platform: ${job.platform}`);
  }
}

function requireContent(job: ClaimedPublicationJob): string {
  const content = job.adapted_content?.trim();

  if (!content) {
    throw new Error("LinkedIn publisher cannot publish empty content");
  }

  return content;
}

function buildLinkedInPostPayload(authorUrn: string, content: string): Record<string, unknown> {
  return {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}

function sanitizeLinkedInError(payload: LinkedInErrorResponse | string): Record<string, unknown> {
  if (typeof payload === "string") {
    return {
      message: payload.slice(0, 1_000),
    };
  }

  return {
    message: typeof payload.message === "string" ? payload.message.slice(0, 1_000) : undefined,
    serviceErrorCode: payload.serviceErrorCode,
    status: payload.status,
    code: payload.code,
  };
}

function extractExternalPostId(response: Response): string {
  const createdEntity = response.headers.get("x-restli-id");

  if (createdEntity) {
    return `linkedin:${createdEntity}`;
  }

  return `linkedin:ugcPosts:${Date.now()}`;
}

function getLinkedInOAuthBaseUrl(): string {
  return workerConfig.linkedinApiBaseUrl.replace(/\/v2\/?$/, "");
}

function getRequiredLinkedInClientEnv(name: "LINKEDIN_CLIENT_ID" | "LINKEDIN_CLIENT_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for LinkedIn refresh`);
  return value;
}

function shouldRefresh(account: DatabaseLinkedInAccount): boolean {
  if (!account.token_expires_at) return false;
  return account.token_expires_at.getTime() - Date.now() <= LINKEDIN_REFRESH_WINDOW_MS;
}

function parseScopes(value: unknown, fallback: string[]): string[] {
  if (typeof value !== "string") return fallback;
  return [...new Set(value.split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean))].sort();
}

async function readLinkedInError(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();

  if (!body) {
    return {
      message: response.statusText,
      status: response.status,
    };
  }

  try {
    return sanitizeLinkedInError(JSON.parse(body) as LinkedInErrorResponse);
  } catch {
    return sanitizeLinkedInError(body);
  }
}

async function refreshDatabaseLinkedInAccount(account: DatabaseLinkedInAccount): Promise<LinkedInCredentials | null> {
  if (!shouldRefresh(account)) {
    return null;
  }

  if (!account.encrypted_refresh_token) {
    return null;
  }

  if (account.refresh_token_expires_at && account.refresh_token_expires_at.getTime() <= Date.now()) {
    await pool.query("update publisher_accounts set status = 'expired', updated_at = now() where id = $1", [account.id]);
    return null;
  }

  const response = await fetch(`${getLinkedInOAuthBaseUrl()}${LINKEDIN_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(account.encrypted_refresh_token),
      client_id: getRequiredLinkedInClientEnv("LINKEDIN_CLIENT_ID"),
      client_secret: getRequiredLinkedInClientEnv("LINKEDIN_CLIENT_SECRET"),
    }),
  });

  const payload = await response.json().catch(() => ({})) as LinkedInTokenResponse;

  if (!response.ok) {
    const message = typeof (payload as { message?: unknown }).message === "string" ? (payload as { message: string }).message : response.statusText;
    throw new Error(`LinkedIn refresh failed: ${message}`);
  }

  if (typeof payload.access_token !== "string") {
    throw new Error("LinkedIn refresh response did not include a publish credential");
  }

  const accessToken = payload.access_token;
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  const tokenExpiresAt = typeof payload.expires_in === "number" ? new Date(Date.now() + payload.expires_in * 1000) : account.token_expires_at;
  const refreshTokenExpiresAt = refreshToken && typeof payload.refresh_token_expires_in === "number"
    ? new Date(Date.now() + payload.refresh_token_expires_in * 1000)
    : account.refresh_token_expires_at;
  const scopes = parseScopes(payload.scope, account.scopes);

  await pool.query(
    `
      update publisher_accounts
      set
        status = 'connected',
        scopes = $2::jsonb,
        encrypted_access_token = $3,
        encrypted_refresh_token = coalesce($4, encrypted_refresh_token),
        token_expires_at = $5,
        refresh_token_expires_at = $6,
        last_validated_at = now(),
        updated_at = now()
      where id = $1
    `,
    [
      account.id,
      JSON.stringify(scopes),
      encryptSecret(accessToken),
      refreshToken ? encryptSecret(refreshToken) : null,
      tokenExpiresAt,
      refreshTokenExpiresAt,
    ],
  );

  return {
    source: "publisher_accounts",
    accountId: account.id,
    authorUrn: account.account_urn,
    accessToken,
    refreshed: true,
  };
}

async function loadLinkedInCredentialsFromDatabase(): Promise<LinkedInCredentials | null> {
  const result = await pool.query<DatabaseLinkedInAccount>(
    `
      select
        id,
        account_urn,
        encrypted_access_token,
        encrypted_refresh_token,
        token_expires_at,
        refresh_token_expires_at,
        scopes
      from publisher_accounts
      where provider = 'linkedin'
        and status = 'connected'
        and encrypted_access_token is not null
      order by updated_at desc
      limit 1
    `,
  );

  const row = result.rows[0];
  if (!row) return null;

  const refreshedCredentials = await refreshDatabaseLinkedInAccount(row);
  if (refreshedCredentials) return refreshedCredentials;

  if (row.token_expires_at && row.token_expires_at.getTime() <= Date.now()) {
    await pool.query("update publisher_accounts set status = 'expired', updated_at = now() where id = $1", [row.id]);
    return null;
  }

  return {
    source: "publisher_accounts",
    accountId: row.id,
    authorUrn: row.account_urn,
    accessToken: decryptSecret(row.encrypted_access_token),
    refreshed: false,
  };
}

async function loadLinkedInCredentials(options: { forceReload?: boolean } = {}): Promise<LinkedInCredentials | null> {
  if (cachedCredentials && !options.forceReload) return cachedCredentials;

  const databaseCredentials = await loadLinkedInCredentialsFromDatabase();

  if (databaseCredentials) {
    cachedCredentials = databaseCredentials;
    return cachedCredentials;
  }

  if (workerConfig.linkedinAccessToken && workerConfig.linkedinAuthorUrn) {
    cachedCredentials = {
      source: "env",
      authorUrn: workerConfig.linkedinAuthorUrn,
      accessToken: workerConfig.linkedinAccessToken,
      refreshed: false,
    };
    return cachedCredentials;
  }

  return null;
}

async function publishLinkedInPost(job: ClaimedPublicationJob): Promise<PublicationPublishResult> {
  requireLinkedInPlatform(job);

  const credentials = await loadLinkedInCredentials({ forceReload: true });

  if (!credentials) {
    throw new Error("LinkedIn publisher credentials are not configured");
  }

  const content = requireContent(job);
  const url = `${workerConfig.linkedinApiBaseUrl}${LINKEDIN_UGC_POSTS_PATH}`;
  const payload = buildLinkedInPostPayload(credentials.authorUrn, content);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await readLinkedInError(response);
    const message = `LinkedIn API error ${response.status}: ${
      typeof errorPayload.message === "string" ? errorPayload.message : response.statusText
    }`;

    throw new PublisherPublishError(message, {
      ok: false,
      provider: "linkedin",
      endpoint: LINKEDIN_UGC_POSTS_PATH,
      status: response.status,
      statusText: response.statusText,
      error: errorPayload,
      contentLength: content.length,
      credentialSource: credentials.source,
      accountId: credentials.accountId,
      credentialRefreshed: credentials.refreshed,
    });
  }

  const externalPostId = extractExternalPostId(response);

  return {
    externalPostId,
    rawResponse: {
      ok: true,
      provider: "linkedin",
      endpoint: LINKEDIN_UGC_POSTS_PATH,
      status: response.status,
      externalPostId,
      contentLength: content.length,
      credentialSource: credentials.source,
      accountId: credentials.accountId,
      credentialRefreshed: credentials.refreshed,
    },
  };
}

export function createLinkedInPublisher(): PublicationPublisher {
  return {
    mode: "linkedin_real",
    component: "linkedin-publisher",
    supportedPlatforms: ["linkedin"],
    isReady: async () => {
      try {
        const credentials = await loadLinkedInCredentials({ forceReload: true });

        if (!credentials) {
          return { ready: false, reason: "LinkedIn credentials are not configured" };
        }

        return { ready: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ready: false, reason: message };
      }
    },
    publish: publishLinkedInPost,
  };
}
