import { workerConfig } from "../config.js";
import { decryptSecret, encryptSecret } from "../crypto.js";
import { pool } from "../db.js";
import type { ClaimedPublicationJob, PublicationPublisher, PublicationPublishResult } from "./types.js";
import { PublisherPublishError } from "./types.js";

const LINKEDIN_POSTS_PATH = "/posts";
const LINKEDIN_ORGANIZATION_ACLS_PATH = "/organizationAcls";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIRED_MEMBER_SCOPE = "w_member_social";
const REQUIRED_ORGANIZATION_SCOPE = "w_organization_social";

type LinkedInErrorResponse = {
  message?: unknown;
  serviceErrorCode?: unknown;
  status?: unknown;
  code?: unknown;
  id?: unknown;
};

type LinkedInTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  refresh_token_expires_in?: unknown;
  scope?: unknown;
};

type LinkedInUserInfo = {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
};

type LinkedInOrganizationAcl = {
  organization?: unknown;
  organizationTarget?: unknown;
  state?: unknown;
  role?: unknown;
};

type LinkedInOrganizationAclsResponse = {
  elements?: unknown;
};

type DatabaseLinkedInAccount = {
  id: string;
  provider: string;
  account_urn: string;
  status: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: Date | null;
  refresh_token_expires_at: Date | null;
  scopes: string[];
};

type LinkedInCredentials = {
  source: "publisher_accounts";
  accountUrn: string;
  authorUrn: string;
  accessToken: string;
  accountId: string;
  refreshed: boolean;
  scopes: string[];
};

type LinkedInPublisherOptions = {
  allowedJobId?: string;
  targetUrn?: string;
};

function requireLinkedInPlatform(job: ClaimedPublicationJob): void {
  if (job.platform !== "linkedin") {
    throw new Error(`LinkedIn publisher cannot publish platform: ${job.platform}`);
  }
}

function requireAllowedJob(job: ClaimedPublicationJob, allowedJobId: string | undefined): void {
  if (!allowedJobId || job.id !== allowedJobId) {
    throw new Error("LinkedIn real publisher rejected a job outside the explicit allowlist");
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
    commentary: content,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

function sanitizeLinkedInPayload(payload: unknown): Record<string, unknown> {
  if (typeof payload === "string") {
    return { message: payload.slice(0, 1_000) };
  }

  if (!payload || typeof payload !== "object") {
    return { message: "Unknown LinkedIn response" };
  }

  const record = payload as LinkedInErrorResponse;
  return {
    message: typeof record.message === "string" ? record.message.slice(0, 1_000) : undefined,
    serviceErrorCode: record.serviceErrorCode,
    status: record.status,
    code: record.code,
    id: typeof record.id === "string" ? record.id : undefined,
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

function isOrganizationTarget(targetUrn: string): boolean {
  return targetUrn.startsWith("urn:li:organization:");
}

function isMemberTarget(targetUrn: string): boolean {
  return targetUrn.startsWith("urn:li:person:");
}

function requiredScopeForTarget(targetUrn: string): string {
  return isOrganizationTarget(targetUrn) ? REQUIRED_ORGANIZATION_SCOPE : REQUIRED_MEMBER_SCOPE;
}

function hasRequiredScope(scopes: string[], targetUrn: string): boolean {
  return scopes.includes(requiredScopeForTarget(targetUrn));
}

function resolveTargetUrn(accountUrn: string, targetUrn: string | undefined): string {
  const resolved = targetUrn?.trim() || accountUrn;

  if (!isMemberTarget(resolved) && !isOrganizationTarget(resolved)) {
    throw new Error("LinkedIn target URN must be a member or organization URN");
  }

  return resolved;
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

async function refreshDatabaseLinkedInAccount(
  account: DatabaseLinkedInAccount,
  targetUrn: string,
): Promise<LinkedInCredentials | null> {
  if (!shouldRefresh(account) || !account.encrypted_refresh_token) {
    return null;
  }

  if (account.refresh_token_expires_at && account.refresh_token_expires_at.getTime() <= Date.now()) {
    await markAccountStatus(account.id, "expired");
    return null;
  }

  const response = await fetch(LINKEDIN_TOKEN_URL, {
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
    const message = typeof (payload as { message?: unknown }).message === "string"
      ? (payload as { message: string }).message
      : response.statusText;
    throw new Error(`LinkedIn refresh failed: ${message}`);
  }

  if (typeof payload.access_token !== "string") {
    throw new Error("LinkedIn refresh response did not include an access token");
  }

  const accessToken = payload.access_token;
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  const tokenExpiresAt = typeof payload.expires_in === "number"
    ? new Date(Date.now() + payload.expires_in * 1000)
    : account.token_expires_at;
  const refreshTokenExpiresAt = refreshToken && typeof payload.refresh_token_expires_in === "number"
    ? new Date(Date.now() + payload.refresh_token_expires_in * 1000)
    : account.refresh_token_expires_at;
  const scopes = parseScopes(payload.scope, account.scopes);

  if (!hasRequiredScope(scopes, targetUrn)) {
    await markAccountStatus(account.id, "invalid");
    throw new Error(`LinkedIn account is missing required scope: ${requiredScopeForTarget(targetUrn)}`);
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
    accountUrn: account.account_urn,
    authorUrn: targetUrn,
    accessToken,
    refreshed: true,
    scopes,
  };
}

async function findConfiguredLinkedInAccount(): Promise<DatabaseLinkedInAccount | null> {
  if (!workerConfig.linkedinPublisherAccountId) return null;

  const result = await pool.query<DatabaseLinkedInAccount>(
    `
      select
        id,
        provider,
        account_urn,
        status,
        encrypted_access_token,
        encrypted_refresh_token,
        token_expires_at,
        refresh_token_expires_at,
        scopes
      from publisher_accounts
      where id = $1
      limit 1
    `,
    [workerConfig.linkedinPublisherAccountId],
  );

  return result.rows[0] ?? null;
}

async function loadLinkedInCredentials(targetUrnOverride: string | undefined): Promise<LinkedInCredentials | null> {
  const account = await findConfiguredLinkedInAccount();
  if (!account) return null;

  if (account.provider !== "linkedin") {
    throw new Error("Configured publisher account is not a LinkedIn account");
  }

  if (account.status !== "connected") {
    throw new Error(`Configured LinkedIn account is not connected: ${account.status}`);
  }

  if (!account.account_urn.startsWith("urn:li:person:")) {
    throw new Error("LinkedIn OAuth account must be a member URN");
  }

  const targetUrn = resolveTargetUrn(account.account_urn, targetUrnOverride);

  if (!hasRequiredScope(account.scopes, targetUrn)) {
    throw new Error(`LinkedIn account is missing required scope: ${requiredScopeForTarget(targetUrn)}`);
  }

  const refreshedCredentials = await refreshDatabaseLinkedInAccount(account, targetUrn);
  if (refreshedCredentials) return refreshedCredentials;

  if (account.token_expires_at && account.token_expires_at.getTime() <= Date.now()) {
    await markAccountStatus(account.id, "expired");
    return null;
  }

  return {
    source: "publisher_accounts",
    accountId: account.id,
    accountUrn: account.account_urn,
    authorUrn: targetUrn,
    accessToken: decryptSecret(account.encrypted_access_token),
    refreshed: false,
    scopes: account.scopes,
  };
}

async function probeLinkedInCredentials(credentials: LinkedInCredentials): Promise<void> {
  const response = await fetch(workerConfig.linkedinUserInfoUrl, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
    },
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await markAccountStatus(credentials.accountId, "invalid");
    }

    const safePayload = sanitizeLinkedInPayload(payload);
    const message = typeof safePayload.message === "string" ? safePayload.message : response.statusText;
    throw new Error(`LinkedIn connection check failed ${response.status}: ${message}`);
  }

  const userInfo = payload as LinkedInUserInfo;
  const subject = typeof userInfo.sub === "string" ? userInfo.sub : null;
  const expectedUrn = subject ? `urn:li:person:${subject}` : null;

  if (!expectedUrn || expectedUrn !== credentials.accountUrn) {
    await markAccountStatus(credentials.accountId, "invalid");
    throw new Error("LinkedIn userinfo subject does not match configured account URN");
  }

  await markAccountStatus(credentials.accountId, "connected");
}

async function probeLinkedInTargetAccess(credentials: LinkedInCredentials): Promise<void> {
  if (isMemberTarget(credentials.authorUrn)) {
    if (credentials.authorUrn !== credentials.accountUrn) {
      throw new Error("LinkedIn member target must match the OAuth account URN");
    }
    return;
  }

  if (!isOrganizationTarget(credentials.authorUrn)) {
    throw new Error("LinkedIn target URN must be a member or organization URN");
  }

  const url = new URL(`${workerConfig.linkedinApiBaseUrl}${LINKEDIN_ORGANIZATION_ACLS_PATH}`);
  url.searchParams.set("q", "roleAssignee");
  url.searchParams.set("state", "APPROVED");
  url.searchParams.set("organization", credentials.authorUrn);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": workerConfig.linkedinApiVersion,
    },
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const safePayload = sanitizeLinkedInPayload(payload);
    const message = typeof safePayload.message === "string" ? safePayload.message : response.statusText;
    throw new Error(`LinkedIn organization target check failed ${response.status}: ${message}`);
  }

  const elements = (payload as LinkedInOrganizationAclsResponse).elements;
  const authorized = Array.isArray(elements) && elements.some((entry) => {
    const acl = entry as LinkedInOrganizationAcl;
    const organization = typeof acl.organization === "string" ? acl.organization : acl.organizationTarget;
    return organization === credentials.authorUrn && acl.state === "APPROVED";
  });

  if (!authorized) {
    throw new Error("LinkedIn OAuth account is not approved for the configured organization target");
  }
}

async function probeLinkedInReady(credentials: LinkedInCredentials): Promise<void> {
  await probeLinkedInCredentials(credentials);
  await probeLinkedInTargetAccess(credentials);
}

function extractLinkedInPostId(response: Response, payload: unknown): string | null {
  const headerId = response.headers.get("x-restli-id")?.trim();
  if (headerId) return headerId;

  if (payload && typeof payload === "object") {
    const id = (payload as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }

  return null;
}

async function publishLinkedInPost(
  job: ClaimedPublicationJob,
  allowedJobId: string | undefined,
  targetUrn: string | undefined,
  validatedCredentials: LinkedInCredentials | null,
): Promise<PublicationPublishResult> {
  requireLinkedInPlatform(job);
  requireAllowedJob(job, allowedJobId);

  const credentials = validatedCredentials ?? await loadLinkedInCredentials(targetUrn);
  if (!credentials) {
    throw new Error("LinkedIn publisher credentials are not configured or have expired");
  }

  if (!validatedCredentials) {
    await probeLinkedInReady(credentials);
  }

  const content = requireContent(job);
  const url = `${workerConfig.linkedinApiBaseUrl}${LINKEDIN_POSTS_PATH}`;
  const payload = buildLinkedInPostPayload(credentials.authorUrn, content);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": workerConfig.linkedinApiVersion,
    },
    body: JSON.stringify(payload),
  });
  const responsePayload = await readResponsePayload(response);

  if (!response.ok) {
    const errorPayload = sanitizeLinkedInPayload(responsePayload);
    const message = `LinkedIn API error ${response.status}: ${
      typeof errorPayload.message === "string" ? errorPayload.message : response.statusText
    }`;

    throw new PublisherPublishError(message, {
      ok: false,
      provider: "linkedin",
      endpoint: LINKEDIN_POSTS_PATH,
      apiVersion: workerConfig.linkedinApiVersion,
      status: response.status,
      statusText: response.statusText,
      error: errorPayload,
      contentLength: content.length,
      credentialSource: credentials.source,
      accountId: credentials.accountId,
      accountUrn: credentials.accountUrn,
      targetUrn: credentials.authorUrn,
      credentialRefreshed: credentials.refreshed,
    });
  }

  const externalPostId = extractLinkedInPostId(response, responsePayload);
  if (!externalPostId) {
    throw new PublisherPublishError("LinkedIn post creation response did not include x-restli-id", {
      ok: false,
      provider: "linkedin",
      endpoint: LINKEDIN_POSTS_PATH,
      apiVersion: workerConfig.linkedinApiVersion,
      status: response.status,
      contentLength: content.length,
      accountId: credentials.accountId,
      accountUrn: credentials.accountUrn,
      targetUrn: credentials.authorUrn,
      postMayHaveBeenCreated: true,
    });
  }

  return {
    externalPostId,
    rawResponse: {
      ok: true,
      provider: "linkedin",
      endpoint: LINKEDIN_POSTS_PATH,
      apiVersion: workerConfig.linkedinApiVersion,
      status: response.status,
      externalPostId,
      contentLength: content.length,
      credentialSource: credentials.source,
      accountId: credentials.accountId,
      accountUrn: credentials.accountUrn,
      targetUrn: credentials.authorUrn,
      credentialRefreshed: credentials.refreshed,
    },
  };
}

export function createLinkedInPublisher(options: LinkedInPublisherOptions = {}): PublicationPublisher {
  let validatedCredentials: LinkedInCredentials | null = null;

  return {
    platform: "linkedin",
    mode: "real",
    component: "linkedin-publisher",
    maxJobsPerTick: 1,
    allowedJobId: options.allowedJobId,
    targetUrn: options.targetUrn,
    isReady: async () => {
      try {
        if (!options.allowedJobId) {
          return { ready: false, reason: "LinkedIn real allowed job ID is not configured" };
        }

        const credentials = await loadLinkedInCredentials(options.targetUrn);
        if (!credentials) {
          return { ready: false, reason: "LinkedIn credentials are not configured or have expired" };
        }

        await probeLinkedInReady(credentials);
        validatedCredentials = credentials;
        return { ready: true };
      } catch (error) {
        validatedCredentials = null;
        const message = error instanceof Error ? error.message : String(error);
        return { ready: false, reason: message };
      }
    },
    publish: async (job) => publishLinkedInPost(job, options.allowedJobId, options.targetUrn, validatedCredentials),
  };
}
