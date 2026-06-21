import { workerConfig } from "../config.js";
import { decryptSecret, encryptSecret } from "../crypto.js";
import { pool } from "../db.js";
import type { ClaimedPublicationJob, PublicationPublisher, PublicationPublishResult } from "./types.js";
import { PublisherPublishError } from "./types.js";

const X_TWEETS_PATH = "/tweets";
const X_USERS_ME_PATH = "/users/me";
const X_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIRED_SCOPE = "tweet.write";
const MAX_TWEET_LENGTH = 280;

type XTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
};

type XUserMeResponse = {
  data?: {
    id?: unknown;
    name?: unknown;
    username?: unknown;
  };
};

type XCreateTweetResponse = {
  data?: {
    id?: unknown;
    text?: unknown;
    edit_history_tweet_ids?: unknown;
  };
  detail?: unknown;
  title?: unknown;
  type?: unknown;
  status?: unknown;
};

type DatabaseXAccount = {
  id: string;
  provider: string;
  account_urn: string;
  status: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: Date | null;
  scopes: string[];
};

type XCredentials = {
  source: "publisher_accounts";
  accountId: string;
  accountUrn: string;
  accessToken: string;
  refreshed: boolean;
  scopes: string[];
};

type XPublisherOptions = {
  allowedJobId?: string;
};

function requireXPlatform(job: ClaimedPublicationJob): void {
  if (job.platform !== "x") {
    throw new Error(`X publisher cannot publish platform: ${job.platform}`);
  }
}

function requireAllowedJob(job: ClaimedPublicationJob, allowedJobId: string | undefined): void {
  if (!allowedJobId || job.id !== allowedJobId) {
    throw new Error("X real publisher rejected a job outside the explicit allowlist");
  }
}

function requireContent(job: ClaimedPublicationJob): string {
  const content = job.adapted_content?.trim();

  if (!content) {
    throw new Error("X publisher cannot publish empty content");
  }

  if (content.length > MAX_TWEET_LENGTH) {
    throw new Error(`X publisher content exceeds ${MAX_TWEET_LENGTH} characters`);
  }

  return content;
}

function sanitizeXPayload(payload: unknown): Record<string, unknown> {
  if (typeof payload === "string") {
    return { message: payload.slice(0, 1_000) };
  }

  if (!payload || typeof payload !== "object") {
    return { message: "Unknown X response" };
  }

  const record = payload as XCreateTweetResponse;
  return {
    detail: typeof record.detail === "string" ? record.detail.slice(0, 1_000) : undefined,
    title: typeof record.title === "string" ? record.title.slice(0, 1_000) : undefined,
    type: record.type,
    status: record.status,
    data: record.data,
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

function getRequiredXClientEnv(name: "X_CLIENT_ID" | "X_CLIENT_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for X refresh`);
  return value;
}

function getClientBasicAuthHeader(): string {
  const clientId = getRequiredXClientEnv("X_CLIENT_ID");
  const clientSecret = getRequiredXClientEnv("X_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function shouldRefresh(account: DatabaseXAccount): boolean {
  if (!account.token_expires_at) return false;
  return account.token_expires_at.getTime() - Date.now() <= X_REFRESH_WINDOW_MS;
}

function parseScopes(value: unknown, fallback: string[]): string[] {
  if (typeof value !== "string") return fallback;
  return [...new Set(value.split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean))].sort();
}

function hasRequiredScope(scopes: string[]): boolean {
  return scopes.includes(REQUIRED_SCOPE);
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

async function refreshDatabaseXAccount(account: DatabaseXAccount): Promise<XCredentials | null> {
  if (!shouldRefresh(account) || !account.encrypted_refresh_token) {
    return null;
  }

  const response = await fetch(workerConfig.xOAuthTokenUrl, {
    method: "POST",
    headers: {
      "Authorization": getClientBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(account.encrypted_refresh_token),
      client_id: getRequiredXClientEnv("X_CLIENT_ID"),
    }),
  });

  const payload = await response.json().catch(() => ({})) as XTokenResponse;

  if (!response.ok) {
    const message = typeof (payload as { error_description?: unknown }).error_description === "string"
      ? (payload as { error_description: string }).error_description
      : typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : response.statusText;
    throw new Error(`X refresh failed: ${message}`);
  }

  if (typeof payload.access_token !== "string") {
    throw new Error("X refresh response did not include an access token");
  }

  const accessToken = payload.access_token;
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  const tokenExpiresAt = typeof payload.expires_in === "number"
    ? new Date(Date.now() + payload.expires_in * 1000)
    : account.token_expires_at;
  const scopes = parseScopes(payload.scope, account.scopes);

  if (!hasRequiredScope(scopes)) {
    await markAccountStatus(account.id, "invalid");
    throw new Error(`X account is missing required scope: ${REQUIRED_SCOPE}`);
  }

  await pool.query(
    `
      update publisher_accounts
      set
        status = 'connected',
        scopes = $2::jsonb,
        encrypted_access_token = $3,
        encrypted_refresh_token = coalesce($4, encrypted_refresh_token),
        token_expires_at = $5,
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
    ],
  );

  return {
    source: "publisher_accounts",
    accountId: account.id,
    accountUrn: account.account_urn,
    accessToken,
    refreshed: true,
    scopes,
  };
}

async function findConfiguredXAccount(): Promise<DatabaseXAccount | null> {
  if (!workerConfig.xPublisherAccountId) return null;

  const result = await pool.query<DatabaseXAccount>(
    `
      select
        id,
        provider,
        account_urn,
        status,
        encrypted_access_token,
        encrypted_refresh_token,
        token_expires_at,
        scopes
      from publisher_accounts
      where id = $1
      limit 1
    `,
    [workerConfig.xPublisherAccountId],
  );

  return result.rows[0] ?? null;
}

async function loadXCredentials(): Promise<XCredentials | null> {
  const account = await findConfiguredXAccount();
  if (!account) return null;

  if (account.provider !== "x") {
    throw new Error("Configured publisher account is not an X account");
  }

  if (account.status !== "connected") {
    throw new Error(`Configured X account is not connected: ${account.status}`);
  }

  if (!account.account_urn.startsWith("urn:x:user:")) {
    throw new Error("X OAuth account must be a user URN");
  }

  if (!hasRequiredScope(account.scopes)) {
    throw new Error(`X account is missing required scope: ${REQUIRED_SCOPE}`);
  }

  const refreshedCredentials = await refreshDatabaseXAccount(account);
  if (refreshedCredentials) return refreshedCredentials;

  if (account.token_expires_at && account.token_expires_at.getTime() <= Date.now()) {
    await markAccountStatus(account.id, "expired");
    return null;
  }

  return {
    source: "publisher_accounts",
    accountId: account.id,
    accountUrn: account.account_urn,
    accessToken: decryptSecret(account.encrypted_access_token),
    refreshed: false,
    scopes: account.scopes,
  };
}

async function probeXCredentials(credentials: XCredentials): Promise<void> {
  const response = await fetch(`${workerConfig.xApiBaseUrl}${X_USERS_ME_PATH}`, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
    },
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await markAccountStatus(credentials.accountId, "invalid");
    }

    const safePayload = sanitizeXPayload(payload);
    const message = typeof safePayload.detail === "string"
      ? safePayload.detail
      : typeof safePayload.title === "string"
        ? safePayload.title
        : response.statusText;
    throw new Error(`X connection check failed ${response.status}: ${message}`);
  }

  const userInfo = payload as XUserMeResponse;
  const userId = typeof userInfo.data?.id === "string" ? userInfo.data.id : null;
  const expectedAccountUrn = userId ? `urn:x:user:${userId}` : null;
  const urnMatches = Boolean(expectedAccountUrn && expectedAccountUrn === credentials.accountUrn);
  const status = urnMatches ? "connected" : "invalid";

  await markAccountStatus(credentials.accountId, status);

  if (!urnMatches) {
    throw new Error("X user lookup id does not match configured account URN");
  }
}

async function createTweet(credentials: XCredentials, content: string): Promise<PublicationPublishResult> {
  const response = await fetch(`${workerConfig.xApiBaseUrl}${X_TWEETS_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: content }),
  });
  const payload = await readResponsePayload(response);
  const safePayload = sanitizeXPayload(payload);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await markAccountStatus(credentials.accountId, "invalid");
    }

    const message = typeof safePayload.detail === "string"
      ? safePayload.detail
      : typeof safePayload.title === "string"
        ? safePayload.title
        : response.statusText;

    throw new PublisherPublishError(`X create tweet failed ${response.status}: ${message}`, {
      ok: false,
      providerStatus: response.status,
      providerResponse: safePayload,
    });
  }

  const created = payload as XCreateTweetResponse;
  const tweetId = typeof created.data?.id === "string" ? created.data.id : null;

  if (!tweetId) {
    throw new PublisherPublishError("X create tweet response did not include a tweet id", {
      ok: false,
      providerStatus: response.status,
      providerResponse: safePayload,
    });
  }

  return {
    externalPostId: `x:${tweetId}`,
    rawResponse: {
      ok: true,
      providerStatus: response.status,
      tweetId,
      accountUrn: credentials.accountUrn,
      refreshed: credentials.refreshed,
      providerResponse: safePayload,
    },
  };
}

export function createXPublisher(options: XPublisherOptions): PublicationPublisher {
  return {
    platform: "x",
    mode: "real",
    component: "x-real-publisher",
    maxJobsPerTick: 1,
    allowedJobId: options.allowedJobId,
    isReady: async () => {
      const credentials = await loadXCredentials();
      if (!credentials) return { ready: false, reason: "x_publisher_credentials_missing_or_expired" };

      await probeXCredentials(credentials);
      return { ready: true };
    },
    publish: async (job: ClaimedPublicationJob): Promise<PublicationPublishResult> => {
      requireXPlatform(job);
      requireAllowedJob(job, options.allowedJobId);
      const content = requireContent(job);
      const credentials = await loadXCredentials();

      if (!credentials) {
        throw new Error("X publisher credentials are missing or expired");
      }

      return createTweet(credentials, content);
    },
  };
}
