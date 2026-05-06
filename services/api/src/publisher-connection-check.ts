import { decryptSecret } from "./crypto.js";
import { pool } from "./db.js";

type StoredPublisherConnection = {
  id: string;
  provider: string;
  account_urn: string;
  display_name: string | null;
  status: string;
  scopes: string[];
  token_expires_at: Date | null;
  encrypted_access_token: string;
};

type LinkedInUserInfo = {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
};

const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

function sanitizeProviderResponse(payload: unknown): Record<string, unknown> {
  if (typeof payload === "string") {
    return { message: payload.slice(0, 1_000) };
  }

  if (!payload || typeof payload !== "object") {
    return { message: "Unknown provider response" };
  }

  const record = payload as Record<string, unknown>;

  return {
    code: record.code,
    message: typeof record.message === "string" ? record.message.slice(0, 1_000) : undefined,
    status: record.status,
    serviceErrorCode: record.serviceErrorCode,
  };
}

async function findStoredPublisherConnection(id: string): Promise<StoredPublisherConnection | null> {
  const result = await pool.query<StoredPublisherConnection>(
    `
      select
        id,
        provider,
        account_urn,
        display_name,
        status,
        scopes,
        token_expires_at,
        encrypted_access_token
      from publisher_accounts
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function markPublisherConnection(id: string, status: string): Promise<void> {
  await pool.query(
    `
      update publisher_accounts
      set status = $2, last_validated_at = now(), updated_at = now()
      where id = $1
    `,
    [id, status],
  );
}

export async function checkPublisherConnection(id: string): Promise<Record<string, unknown> | null> {
  const account = await findStoredPublisherConnection(id);

  if (!account) return null;

  if (account.provider !== "linkedin") {
    return {
      ok: false,
      provider: account.provider,
      accountUrn: account.account_urn,
      status: account.status,
      message: "Connection check currently supports LinkedIn only",
    };
  }

  if (account.token_expires_at && account.token_expires_at.getTime() <= Date.now()) {
    await markPublisherConnection(account.id, "expired");

    return {
      ok: false,
      provider: account.provider,
      accountUrn: account.account_urn,
      status: "expired",
      message: "Provider credential expired",
    };
  }

  const credential = decryptSecret(account.encrypted_access_token);
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${credential}`,
    },
  });

  const text = await response.text();
  let payload: unknown = text;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = text;
  }

  if (!response.ok) {
    await markPublisherConnection(account.id, "invalid");

    return {
      ok: false,
      provider: account.provider,
      accountUrn: account.account_urn,
      status: "invalid",
      providerStatus: response.status,
      providerResponse: sanitizeProviderResponse(payload),
    };
  }

  const userInfo = payload as LinkedInUserInfo;
  const subject = typeof userInfo.sub === "string" ? userInfo.sub : null;
  const expectedAccountUrn = subject ? `urn:li:person:${subject}` : null;
  const urnMatches = Boolean(expectedAccountUrn && expectedAccountUrn === account.account_urn);
  const status = urnMatches ? "connected" : "invalid";

  await markPublisherConnection(account.id, status);

  return {
    ok: urnMatches,
    provider: account.provider,
    accountUrn: account.account_urn,
    expectedAccountUrn,
    status,
    subject,
    displayName: typeof userInfo.name === "string" ? userInfo.name : null,
    email: typeof userInfo.email === "string" ? userInfo.email : null,
    scopes: account.scopes,
  };
}
