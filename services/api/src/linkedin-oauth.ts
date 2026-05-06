import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { encryptSecret } from "./crypto.js";
import { pool } from "./db.js";

const LINKEDIN_AUTHORIZATION_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_EXCHANGE_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const DEFAULT_SCOPES = ["openid", "profile", "email", "w_member_social"];
const STATE_TTL_SECONDS = 15 * 60;

type LinkedInExchangeResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  refresh_token_expires_in?: unknown;
  scope?: unknown;
  token_type?: unknown;
};

type LinkedInUserInfo = {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
};

type OAuthState = {
  nonce: string;
  createdAt: number;
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
  const explicit = process.env.LINKEDIN_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const apiDomain = getRequiredEnv("API_DOMAIN");
  return `https://${apiDomain}/publisher-accounts/linkedin/oauth/callback`;
}

function getScopes(): string[] {
  const raw = process.env.LINKEDIN_OAUTH_SCOPES?.trim();
  if (!raw) return DEFAULT_SCOPES;

  return [...new Set(raw.split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean))];
}

function signStatePayload(payload: string): string {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

function createOAuthState(): string {
  const payload: OAuthState = {
    nonce: randomBytes(16).toString("base64url"),
    createdAt: Math.floor(Date.now() / 1000),
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

  return payload;
}

function parseScopes(value: unknown): string[] {
  if (typeof value !== "string") return getScopes();

  return [...new Set(value.split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean))].sort();
}

async function exchangeCodeForCredential(code: string): Promise<LinkedInExchangeResponse> {
  const response = await fetch(LINKEDIN_EXCHANGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: getRequiredEnv("LINKEDIN_CLIENT_ID"),
      client_secret: getRequiredEnv("LINKEDIN_CLIENT_SECRET"),
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : response.statusText;
    throw new Error(`LinkedIn OAuth exchange failed: ${message}`);
  }

  return payload as LinkedInExchangeResponse;
}

async function readLinkedInUserInfo(credential: string): Promise<LinkedInUserInfo> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${credential}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : response.statusText;
    throw new Error(`LinkedIn userinfo failed: ${message}`);
  }

  return payload as LinkedInUserInfo;
}

async function upsertLinkedInAccountFromOAuth(exchange: LinkedInExchangeResponse, userInfo: LinkedInUserInfo) {
  const credential = typeof exchange.access_token === "string" ? exchange.access_token : null;
  const renewalCredential = typeof exchange.refresh_token === "string" ? exchange.refresh_token : null;
  const subject = typeof userInfo.sub === "string" ? userInfo.sub : null;

  if (!credential) throw new Error("LinkedIn OAuth response did not include a publish credential");
  if (!subject) throw new Error("LinkedIn userinfo did not include a subject");

  const accountUrn = `urn:li:person:${subject}`;
  const displayName = typeof userInfo.name === "string" ? userInfo.name : null;
  const scopes = parseScopes(exchange.scope);
  const expiresIn = typeof exchange.expires_in === "number" ? exchange.expires_in : null;
  const renewalExpiresIn = typeof exchange.refresh_token_expires_in === "number" ? exchange.refresh_token_expires_in : null;
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  const renewalExpiresAt = renewalCredential && renewalExpiresIn ? new Date(Date.now() + renewalExpiresIn * 1000) : null;
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
      ) values ($1, 'linkedin', $2, $3, 'connected', $4::jsonb, $5, $6, $7, $8, now(), now(), now())
      on conflict (provider, account_urn) do update set
        display_name = excluded.display_name,
        status = 'connected',
        scopes = excluded.scopes,
        encrypted_access_token = excluded.encrypted_access_token,
        encrypted_refresh_token = coalesce(excluded.encrypted_refresh_token, publisher_accounts.encrypted_refresh_token),
        token_expires_at = excluded.token_expires_at,
        refresh_token_expires_at = case
          when excluded.encrypted_refresh_token is not null then excluded.refresh_token_expires_at
          else publisher_accounts.refresh_token_expires_at
        end,
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
      renewalExpiresAt,
    ],
  );

  return {
    id: result.rows[0].id,
    provider: "linkedin",
    accountUrn,
    displayName,
    scopes,
    tokenExpiresAt,
    hasRefreshToken: Boolean(renewalCredential),
  };
}

export function createLinkedInAuthorizationUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getRequiredEnv("LINKEDIN_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    scope: getScopes().join(" "),
    state: createOAuthState(),
  });

  return `${LINKEDIN_AUTHORIZATION_URL}?${params.toString()}`;
}

export async function completeLinkedInOAuth(code: string, state: string) {
  verifyOAuthState(state);
  const exchange = await exchangeCodeForCredential(code);
  const credential = typeof exchange.access_token === "string" ? exchange.access_token : "";
  const userInfo = await readLinkedInUserInfo(credential);
  return upsertLinkedInAccountFromOAuth(exchange, userInfo);
}

export function getLinkedInOAuthCallbackPath(): string {
  return "/publisher-accounts/linkedin/oauth/callback";
}
