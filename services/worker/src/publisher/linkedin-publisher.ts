import { workerConfig } from "../config.js";
import { decryptSecret } from "../crypto.js";
import { pool } from "../db.js";
import type { ClaimedPublicationJob, PublicationPublisher, PublicationPublishResult } from "./types.js";
import { PublisherPublishError } from "./types.js";

const LINKEDIN_UGC_POSTS_PATH = "/ugcPosts";

type LinkedInErrorResponse = {
  message?: unknown;
  serviceErrorCode?: unknown;
  status?: unknown;
  code?: unknown;
};

type LinkedInCredentials = {
  source: "publisher_accounts" | "env";
  authorUrn: string;
  accessToken: string;
  accountId?: string;
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

async function loadLinkedInCredentialsFromDatabase(): Promise<LinkedInCredentials | null> {
  const result = await pool.query<{
    id: string;
    account_urn: string;
    encrypted_access_token: string;
  }>(
    `
      select id, account_urn, encrypted_access_token
      from publisher_accounts
      where provider = 'linkedin'
        and status = 'connected'
        and encrypted_access_token is not null
        and (token_expires_at is null or token_expires_at > now())
      order by updated_at desc
      limit 1
    `,
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    source: "publisher_accounts",
    accountId: row.id,
    authorUrn: row.account_urn,
    accessToken: decryptSecret(row.encrypted_access_token),
  };
}

async function loadLinkedInCredentials(): Promise<LinkedInCredentials | null> {
  if (cachedCredentials) return cachedCredentials;

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
    };
    return cachedCredentials;
  }

  return null;
}

async function publishLinkedInPost(job: ClaimedPublicationJob): Promise<PublicationPublishResult> {
  requireLinkedInPlatform(job);

  const credentials = await loadLinkedInCredentials();

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
        const credentials = await loadLinkedInCredentials();

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
