import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type OneShotParams = {
  id: string;
};

type OneShotPreflightBody = {
  platform?: string;
  publisherAccountId?: string;
  requiredScope?: string;
  maxContentLength?: number;
};

type PublicationJobRow = {
  id: string;
  platform: string;
  status: string;
  adapted_content: string | null;
  external_post_id: string | null;
  published_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

type PublisherAccountRow = {
  id: string;
  provider: string;
  account_urn: string;
  display_name: string | null;
  status: string;
  scopes: string[];
  last_validated_at: Date | null;
  updated_at: Date;
};

type NormalizedBody = {
  platform: string | null;
  publisherAccountId: string | null;
  requiredScope: string | null;
  maxContentLength: number | null;
};

function normalizeBody(body: OneShotPreflightBody | undefined): NormalizedBody {
  const maxContentLength = Number(body?.maxContentLength);

  return {
    platform: body?.platform?.trim().toLowerCase() || null,
    publisherAccountId: body?.publisherAccountId?.trim() || null,
    requiredScope: body?.requiredScope?.trim() || null,
    maxContentLength: Number.isFinite(maxContentLength) && maxContentLength > 0
      ? Math.trunc(maxContentLength)
      : null,
  };
}

async function findJob(jobId: string): Promise<PublicationJobRow | null> {
  const result = await pool.query<PublicationJobRow>(
    `
      select
        id,
        platform,
        status,
        adapted_content,
        external_post_id,
        published_at,
        error_message,
        created_at,
        updated_at
      from publication_jobs
      where id = $1
      limit 1
    `,
    [jobId],
  );

  return result.rows[0] ?? null;
}

async function findAccount(accountId: string | null, provider: string): Promise<{
  account: PublisherAccountRow | null;
  ambiguity: PublisherAccountRow[];
}> {
  if (accountId) {
    const result = await pool.query<PublisherAccountRow>(
      `
        select
          id,
          provider,
          account_urn,
          display_name,
          status,
          scopes,
          last_validated_at,
          updated_at
        from publisher_accounts
        where id = $1
        limit 1
      `,
      [accountId],
    );

    return { account: result.rows[0] ?? null, ambiguity: [] };
  }

  const result = await pool.query<PublisherAccountRow>(
    `
      select
        id,
        provider,
        account_urn,
        display_name,
        status,
        scopes,
        last_validated_at,
        updated_at
      from publisher_accounts
      where provider = $1
        and status = 'connected'
      order by updated_at desc
      limit 2
    `,
    [provider],
  );

  if (result.rows.length === 1) {
    return { account: result.rows[0], ambiguity: [] };
  }

  return { account: null, ambiguity: result.rows };
}

function validateJob(job: PublicationJobRow | null, expectedPlatform: string | null, maxContentLength: number | null): string[] {
  if (!job) return ["publication_job_not_found"];

  const errors: string[] = [];
  const content = String(job.adapted_content ?? "").trim();
  const platform = expectedPlatform ?? job.platform;

  if (job.platform !== platform) errors.push("job_platform_mismatch");
  if (job.status !== "approved") errors.push("job_must_be_approved");
  if (job.external_post_id) errors.push("job_already_has_external_post_id");
  if (job.published_at) errors.push("job_already_has_published_at");
  if (!content) errors.push("job_content_empty");
  if (maxContentLength && content.length > maxContentLength) errors.push("job_content_exceeds_limit");

  return errors;
}

function validateAccount(
  account: PublisherAccountRow | null,
  provider: string,
  requiredScope: string | null,
): string[] {
  if (!account) return ["publisher_account_not_found_or_ambiguous"];

  const errors: string[] = [];

  if (account.provider !== provider) errors.push("publisher_account_provider_mismatch");
  if (account.status !== "connected") errors.push("publisher_account_not_connected");
  if (requiredScope && !account.scopes.includes(requiredScope)) errors.push("publisher_account_missing_required_scope");

  return errors;
}

export async function registerOneShotOperatorRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: OneShotParams; Body: OneShotPreflightBody }>(
    "/publication-jobs/:id/one-shot/preflight",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const body = normalizeBody(request.body);
      const job = await findJob(request.params.id);
      const provider = body.platform ?? job?.platform ?? null;

      if (!provider) {
        return reply.code(400).send({
          error: "platform_required",
          message: "A platform is required when the job cannot be loaded.",
        });
      }

      const { account, ambiguity } = await findAccount(body.publisherAccountId, provider);

      if (ambiguity.length > 1) {
        return reply.code(409).send({
          error: "ambiguous_publisher_account",
          message: "Multiple connected publisher accounts match this provider. Provide publisherAccountId explicitly.",
          accounts: ambiguity.map((item) => ({
            id: item.id,
            provider: item.provider,
            accountUrn: item.account_urn,
            displayName: item.display_name,
            status: item.status,
            scopes: item.scopes,
          })),
        });
      }

      if (!job) {
        return reply.code(404).send({ error: "not_found", message: "Publication job not found" });
      }

      const jobErrors = validateJob(job, body.platform, body.maxContentLength);
      const accountErrors = validateAccount(account, provider, body.requiredScope);
      const content = String(job.adapted_content ?? "").trim();

      if (jobErrors.length > 0 || accountErrors.length > 0 || !account) {
        return reply.code(409).send({
          error: "one_shot_not_ready",
          message: "One-shot preflight failed. Fix the reported errors first.",
          jobErrors,
          accountErrors,
          job: {
            id: job.id,
            platform: job.platform,
            status: job.status,
            externalPostId: job.external_post_id,
            publishedAt: job.published_at,
            contentLength: content.length,
          },
          account: account
            ? {
                id: account.id,
                provider: account.provider,
                accountUrn: account.account_urn,
                displayName: account.display_name,
                status: account.status,
                scopes: account.scopes,
              }
            : null,
        });
      }

      return {
        ok: true,
        mode: "preflight_only",
        warning: "This endpoint does not perform the external provider action. It only confirms readiness for a separately controlled one-shot run.",
        job: {
          id: job.id,
          platform: job.platform,
          status: job.status,
          contentLength: content.length,
          maxContentLength: body.maxContentLength,
          contentPreview: content.slice(0, body.maxContentLength ?? 500),
        },
        account: {
          id: account.id,
          provider: account.provider,
          accountUrn: account.account_urn,
          displayName: account.display_name,
          scopes: account.scopes,
        },
        controls: {
          exactJobIdRequired: true,
          normalWorkerMustBeStopped: true,
          isolatedWorkerTickOnly: true,
          returnToSafeModeAfterRun: true,
        },
      };
    },
  );
}
