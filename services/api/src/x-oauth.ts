import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { pool } from "./db.js";

const X_AUTHORIZATION_URL = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_USER_ME_PATH = "/users/me";
const DEFAULT_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];
const STATE_TTL_SECONDS = 15 * 60;
const REFRESH_WINDOW_SECONDS = 7 * 24 * 60 * 60;

type XExchangeResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  token_type?: unknown;
};

type XUserMeResponse = {
  data?: {
    id?: unknown;
    name?: unknown;
    username?: unknown;
  };
};

type OAuthState = {
  nonce: string;
  createdAt: number;
  codeVerifier: string;
};

type RefreshableXAccount = {
  id: string;
  provider: string;
  account_urn: string;
  scopes: string[];
  token_expires_at: Date | null;
  refresh_token_expires_at: Date | null;
  encrypted_refresh_token: string | null;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getStateSecret(): string {
  return process.env.SESSION_SECRET?.trim() || getRequiredEnv("ADMIN_API_TOKEN");
}

function getRedirectUri(): string {
  const explicit = process.env.X_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const apiDomain = getRequiredEnv("API_DOMAIN");
  return `https://${apiDomain}/publisher-accounts/x/oauth/callback`;
}

function getTokenUrl(): string {
  return process.env.X_OAUTH_TOKEN_URL?.trim() || X_TOKEN_URL;
}

function getApiBaseUrl(): string {
  return (process.env.X_API_BASE_URL?.trim() || "https://api.x.com/2").replace(/\/+$/, "");
}

function getScopes(): string[] {
  const raw = process.env.X_OAUTH_SCOPES?.trim();
  if (!raw) return DEFAULT_SCOPES;

  return [...new Set(raw.split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean))];
}

function signStatePayload(payload: string): string {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

function createCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function createCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function createOAuthState(codeVerifier: string): string {
  const payload: OAuthState = {
    nonce: randomBytes(16).toString("base64url"),
    createdAt: Math.floor(Date.now() / 1000),
    codeVerifier,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signStatePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyOAuthState(state: string): OAuthState {
  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("Invalid OAuth state format");
  }

  const expectedSignature = signStatePayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error("Invalid OAuth state signature");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthState;
  const now = Math.floor(Date.now() / 1000);

  if (!payload.createdAt || now - payload.createdAt > STATE_TTL_SECONDS) {
    throw new Error("OAuth state expired");
  }

  if (!payload.codeVerifier) {
    throw new Error("OAuth state is missing a PKCE code verifier");
  }

  return payload;
}

function parseScopes(value: unknown): string[] {
  if (typeof value !== "string") return getScopes();

  return [...new Set(value.split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean))].sort();
}

function secondsUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((date.getTime() - Date.now()) / 1000);
}

function shouldRefreshAccount(account: RefreshableXAccount): boolean {
  const seconds = secondsUntil(account.token_expires_at);
  return seconds !== null && seconds <= REFRESH_WINDOW_SECONDS;
}

function getClientBasicAuthHeader(): string {
  const clientId = getRequiredEnv("X_CLIENT_ID");
  const clientSecret = getRequiredEnv("X_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

async function exchangeCodeForCredential(code: string, codeVerifier: string): Promise<XExchangeResponse> {
  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: {
      "Authorization": getClientBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
      client_id: getRequiredEnv("X_CLIENT_ID"),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.error_description === "string"
      ? payload.error_description
      : typeof payload?.error === "string"
        ? payload.error
        : response.statusText;
    throw new Error(`X OAuth exchange failed: ${message}`);
  }

  return payload as XExchangeResponse;
}

async function exchangeRefreshCredential(refreshCredential: string): Promise<XExchangeResponse> {
  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: {
      "Authorization": getClientBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshCredential,
      client_id: getRequiredEnv("X_CLIENT_ID"),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.error_description === "string"
      ? payload.error_description
      : typeof payload?.error === "string"
        ? payload.error
        : response.statusText;
    throw new Error(`X refresh failed: ${message}`);
  }

  return payload as XExchangeResponse;
}

async function readXUserMe(credential: string): Promise<XUserMeResponse> {
  const response = await fetch(`${getApiBaseUrl()}${X_USER_ME_PATH}`, {
    headers: {
      Authorization: `Bearer ${credential}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.detail === "string"
      ? payload.detail
      : typeof payload?.title === "string"
        ? payload.title
        : response.statusText;
    throw new Error(`X user lookup failed: ${message}`);
  }

  return payload as XUserMeResponse;
}

async function upsertXAccountFromOAuth(exchange: XExchangeResponse, userInfo: XUserMeResponse) {
  const credential = typeof exchange.access_token === "string" ? exchange.access_token : null;
  const renewalCredential = typeof exchange.refresh_token === "string" ? exchange.refresh_token : null;
  const user = userInfo.data && typeof userInfo.data === "object" ? userInfo.data : null;
  const userId = typeof user?.id === "string" ? user.id : null;

  if (!credential) throw new Error("X OAuth response did not include a publish credential");
  if (!userId) throw new Error("X user lookup did not include a user id");

  const accountUrn = `urn:x:user:${userId}`;
  const name = typeof user?.name === "string" ? user.name : null;
  const username = typeof user?.username === "string" ? user.username : null;
  const displayName = username ? `${name ?? username} (@${username})` : name;
  const scopes = parseScopes(exchange.scope);
  const expiresIn = typeof exchange.expires_in === "number" ? exchange.expires_in : null;
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  const id = randomBytes(16).toString("hex");

  const result = await pool.query<{ id: string }>(
    `
      insert into publisher_accounts (
        id,
        provider,
        account_urn,
        display_name,
        status,
        scopes,
        encrypted_access_token,
        encrypted_refresh_token,
        token_expires_at,
        refresh_token_expires_at,
        last_validated_at,
        created_at,
        updated_at
      ) values ($1, 'x', $2, $3, 'connected', $4::jsonb, $5, $6, $7, null, now(), now(), now())
      on conflict (provider, account_urn) do update set
        display_name = excluded.display_name,
        status = 'connected',
        scopes = excluded.scopes,
        encrypted_access_token = excluded.encrypted_access_token,
        encrypted_refresh_token = coalesce(excluded.encrypted_refresh_token, publisher_accounts.encrypted_refresh_token),
        token_expires_at = excluded.token_expires_at,
        refresh_token_expires_at = publisher_accounts.refresh_token_expires_at,
        last_validated_at = now(),
        updated_at = now()
      returning id
    `,
    [
      id,
      accountUrn,
      displayName,
      JSON.stringify(scopes),
      encryptSecret(credential),
      renewalCredential ? encryptSecret(renewalCredential) : null,
      tokenExpiresAt,
    ],
  );

  return {
    id: result.rows[0].id,
    provider: "x",
    accountUrn,
    displayName,
    scopes,
    tokenExpiresAt,
    hasRefreshToken: Boolean(renewalCredential),
  };
}

async function findRefreshableXAccount(id: string): Promise<RefreshableXAccount | null> {
  const result = await pool.query<RefreshableXAccount>(
    `
      select
        id,
        provider,
        account_urn,
        scopes,
        token_expires_at,
        refresh_token_expires_at,
        encrypted_refresh_token
      from publisher_accounts
      where id = $1
        and provider = 'x'
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function updateXAccountAfterRefresh(account: RefreshableXAccount, exchange: XExchangeResponse) {
  const credential = typeof exchange.access_token === "string" ? exchange.access_token : null;
  const renewalCredential = typeof exchange.refresh_token === "string" ? exchange.refresh_token : null;
  const expiresIn = typeof exchange.expires_in === "number" ? exchange.expires_in : null;

  if (!credential) {
    throw new Error("X refresh response did not include an access token");
  }

  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : account.token_expires_at;
  const scopes = parseScopes(exchange.scope).length > 0 ? parseScopes(exchange.scope) : account.scopes;

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
      encryptSecret(credential),
      renewalCredential ? encryptSecret(renewalCredential) : null,
      tokenExpiresAt,
    ],
  );

  return {
    id: account.id,
    provider: "x",
    accountUrn: account.account_urn,
    scopes,
    tokenExpiresAt,
    refreshed: true,
  };
}

export function createXAuthorizationUrl(): string {
  const codeVerifier = createCodeVerifier();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getRequiredEnv("X_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    scope: getScopes().join(" "),
    state: createOAuthState(codeVerifier),
    code_challenge: createCodeChallenge(codeVerifier),
    code_challenge_method: "S256",
  });

  return `${X_AUTHORIZATION_URL}?${params.toString()}`;
}

export async function completeXOAuth(code: string, state: string) {
  const oauthState = verifyOAuthState(state);
  const exchange = await exchangeCodeForCredential(code, oauthState.codeVerifier);
  const credential = typeof exchange.access_token === "string" ? exchange.access_token : "";
  const userInfo = await readXUserMe(credential);
  return upsertXAccountFromOAuth(exchange, userInfo);
}

export async function refreshXAccount(id: string, options: { force?: boolean } = {}) {
  const account = await findRefreshableXAccount(id);

  if (!account) {
    return null;
  }

  if (!account.encrypted_refresh_token) {
    return {
      id: account.id,
      provider: "x",
      accountUrn: account.account_urn,
      refreshed: false,
      reason: "missing_refresh_credential",
    };
  }

  if (!options.force && !shouldRefreshAccount(account)) {
    return {
      id: account.id,
      provider: "x",
      accountUrn: account.account_urn,
      refreshed: false,
      reason: "refresh_not_required",
      tokenExpiresAt: account.token_expires_at,
    };
  }

  const refreshCredential = decryptSecret(account.encrypted_refresh_token);
  const exchange = await exchangeRefreshCredential(refreshCredential);
  return updateXAccountAfterRefresh(account, exchange);
}
