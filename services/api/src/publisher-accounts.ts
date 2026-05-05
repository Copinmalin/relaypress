import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { encryptSecret } from "./crypto.js";
import { pool } from "./db.js";

type PublisherAccountsQuery = {
  provider?: string;
  status?: string;
};

type PublisherAccountParams = {
  id: string;
};

type UpsertPublisherAccountBody = {
  provider?: string;
  accountUrn?: string;
  displayName?: string;
  scopes?: string[];
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
};

const SUPPORTED_PROVIDERS = new Set(["linkedin", "x", "facebook", "instagram", "mastodon", "wordpress"]);

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return parsed;
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  return [...new Set((scopes ?? []).map((scope) => scope.trim()).filter(Boolean))].sort();
}

function rowToPublisherAccount(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    accountUrn: row.account_urn,
    displayName: row.display_name,
    status: row.status,
    scopes: row.scopes,
    tokenExpiresAt: row.token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    lastValidatedAt: row.last_validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasAccessToken: Boolean(row.encrypted_access_token),
    hasRefreshToken: Boolean(row.encrypted_refresh_token),
  };
}

async function findPublisherAccountById(id: string) {
  const result = await pool.query(
    `
      select
        id,
        provider,
        account_urn,
        display_name,
        status,
        scopes,
        token_expires_at,
        refresh_token_expires_at,
        last_validated_at,
        created_at,
        updated_at,
        encrypted_access_token,
        encrypted_refresh_token
      from publisher_accounts
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ? rowToPublisherAccount(result.rows[0]) : null;
}

async function upsertPublisherAccount(body: Required<Pick<UpsertPublisherAccountBody, "provider" | "accountUrn" | "accessToken">> & UpsertPublisherAccountBody) {
  const provider = body.provider.trim().toLowerCase();
  const accountUrn = body.accountUrn.trim();
  const displayName = body.displayName?.trim() || null;
  const scopes = normalizeScopes(body.scopes);
  const encryptedAccessToken = encryptSecret(body.accessToken);
  const encryptedRefreshToken = body.refreshToken?.trim() ? encryptSecret(body.refreshToken) : null;
  const tokenExpiresAt = parseIsoDate(body.tokenExpiresAt);
  const refreshTokenExpiresAt = parseIsoDate(body.refreshTokenExpiresAt);
  const id = randomUUID();

  const result = await pool.query(
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
      ) values ($1, $2, $3, $4, 'connected', $5::jsonb, $6, $7, $8, $9, now(), now(), now())
      on conflict (provider, account_urn) do update set
        display_name = excluded.display_name,
        status = 'connected',
        scopes = excluded.scopes,
        encrypted_access_token = excluded.encrypted_access_token,
        encrypted_refresh_token = coalesce(excluded.encrypted_refresh_token, publisher_accounts.encrypted_refresh_token),
        token_expires_at = excluded.token_expires_at,
        refresh_token_expires_at = coalesce(excluded.refresh_token_expires_at, publisher_accounts.refresh_token_expires_at),
        last_validated_at = now(),
        updated_at = now()
      returning id
    `,
    [
      id,
      provider,
      accountUrn,
      displayName,
      JSON.stringify(scopes),
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt,
      refreshTokenExpiresAt,
    ],
  );

  return findPublisherAccountById(result.rows[0].id);
}

export async function registerPublisherAccountRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: PublisherAccountsQuery }>(
    "/publisher-accounts",
    { preHandler: requireAdminToken },
    async (request) => {
      const values: unknown[] = [];
      const clauses: string[] = [];

      if (request.query.provider) {
        values.push(request.query.provider.trim().toLowerCase());
        clauses.push(`provider = $${values.length}`);
      }

      if (request.query.status) {
        values.push(request.query.status.trim().toLowerCase());
        clauses.push(`status = $${values.length}`);
      }

      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";

      const result = await pool.query(
        `
          select
            id,
            provider,
            account_urn,
            display_name,
            status,
            scopes,
            token_expires_at,
            refresh_token_expires_at,
            last_validated_at,
            created_at,
            updated_at,
            encrypted_access_token,
            encrypted_refresh_token
          from publisher_accounts
          ${where}
          order by updated_at desc
        `,
        values,
      );

      return {
        count: result.rowCount,
        accounts: result.rows.map(rowToPublisherAccount),
      };
    },
  );

  app.get<{ Params: PublisherAccountParams }>(
    "/publisher-accounts/:id",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const account = await findPublisherAccountById(request.params.id);

      if (!account) {
        return reply.code(404).send({ error: "not_found", message: "Publisher account not found" });
      }

      return { account };
    },
  );

  app.post<{ Body: UpsertPublisherAccountBody }>(
    "/publisher-accounts",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const provider = request.body?.provider?.trim().toLowerCase();
      const accountUrn = request.body?.accountUrn?.trim();
      const accessToken = request.body?.accessToken?.trim();

      if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
        return reply.code(400).send({ error: "invalid_provider", message: "Unsupported publisher provider" });
      }

      if (!accountUrn) {
        return reply.code(400).send({ error: "invalid_account_urn", message: "accountUrn is required" });
      }

      if (!accessToken) {
        return reply.code(400).send({ error: "invalid_access", message: "accessToken is required" });
      }

      try {
        const account = await upsertPublisherAccount({
          ...request.body,
          provider,
          accountUrn,
          accessToken,
        });

        return { account };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.code(400).send({ error: "publisher_account_not_saved", message });
      }
    },
  );
}
