import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { adaptPublicationContent, type PublicationTarget } from "./content-adapter.js";
import { pool } from "./db.js";

type PublicationJobStatus =
  | "pending"
  | "pending_review"
  | "drafted"
  | "approved"
  | "publishing"
  | "rejected"
  | "published"
  | "failed"
  | "archived";

type SortOrder = "asc" | "desc";
type PublicationJobsView = "todo" | "active" | "archived";

type PublicationJobsQuery = {
  status?: PublicationJobStatus;
  platform?: string;
  limit?: string;
  order?: SortOrder;
  view?: PublicationJobsView;
};

type PublicationJobParams = {
  id: string;
};

type RejectBody = {
  reason?: string;
};

type UpdateContentBody = {
  content?: string;
};

type ManualDraftBody = {
  content?: string;
  platforms?: string[];
};

const SUPPORTED_MANUAL_PLATFORMS = new Set(["x", "linkedin", "facebook", "instagram"]);

const PUBLICATION_JOB_SELECT = `
  select
    j.id,
    j.source_event_id,
    j.platform,
    j.status,
    j.source_content,
    j.adapted_content,
    j.external_post_id,
    j.error_message,
    j.scheduled_at,
    j.published_at,
    j.created_at,
    j.updated_at,
    e.id as event_id,
    e.kind as event_kind,
    e.pubkey as event_pubkey,
    e.content as event_content,
    e.created_at as event_created_at,
    e.indexed_at as event_indexed_at
  from publication_jobs j
  left join nostr_events e on e.id = j.source_event_id
`;

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseOrder(value: string | undefined): SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function parseManualPlatforms(platforms: string[] | undefined): PublicationTarget[] {
  const normalized = [...new Set((platforms ?? []).map((platform) => platform.trim().toLowerCase()))];
  return normalized.filter((platform): platform is PublicationTarget => SUPPORTED_MANUAL_PLATFORMS.has(platform));
}

function rowToPublicationJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    platform: row.platform,
    status: row.status,
    sourceContent: row.source_content,
    adaptedContent: row.adapted_content,
    externalPostId: row.external_post_id,
    errorMessage: row.error_message,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceEvent: row.event_id
      ? {
          id: row.event_id,
          kind: row.event_kind,
          pubkey: row.event_pubkey,
          content: row.event_content,
          createdAt: row.event_created_at,
          indexedAt: row.event_indexed_at,
        }
      : null,
  };
}

function rowToPublicationJobRun(row: Record<string, unknown>) {
  return {
    id: row.id,
    jobId: row.job_id,
    platform: row.platform,
    status: row.status,
    mode: row.mode,
    externalPostId: row.external_post_id,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    rawResponse: row.raw_response,
  };
}

async function findPublicationJobById(id: string) {
  const result = await pool.query(
    `
      ${PUBLICATION_JOB_SELECT}
      where j.id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ? rowToPublicationJob(result.rows[0]) : null;
}

async function findPublicationJobsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const result = await pool.query(
    `
      ${PUBLICATION_JOB_SELECT}
      where j.id = any($1::varchar[])
      order by j.created_at asc
    `,
    [ids],
  );

  return result.rows.map(rowToPublicationJob);
}

async function createManualDraftJobs(content: string, platforms: PublicationTarget[]) {
  const draftId = randomUUID();
  const jobIds = platforms.map((platform) => `manual:${draftId}:${platform}`);

  await pool.query("begin");

  try {
    for (const platform of platforms) {
      const adapted = adaptPublicationContent(content, platform);
      await pool.query(
        `
          insert into publication_jobs (
            id,
            source_event_id,
            platform,
            status,
            source_content,
            adapted_content,
            error_message,
            created_at,
            updated_at
          ) values ($1, null, $2, 'pending_review', $3, $4, $5, now(), now())
        `,
        [
          `manual:${draftId}:${platform}`,
          platform,
          adapted.sourceContent,
          adapted.content,
          adapted.warnings.length > 0 ? adapted.warnings.join(",") : null,
        ],
      );
    }

    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }

  return findPublicationJobsByIds(jobIds);
}

async function approvePublicationJob(id: string) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        status = 'approved',
        error_message = null,
        updated_at = now()
      where id = $1
        and status in ('pending', 'pending_review')
        and external_post_id is null
        and published_at is null
      returning id
    `,
    [id],
  );

  if (result.rowCount === 0) return null;
  return findPublicationJobById(id);
}

async function rejectPublicationJob(id: string, reason: string) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        status = 'rejected',
        error_message = $2,
        updated_at = now()
      where id = $1
        and status in ('pending', 'pending_review', 'approved')
        and external_post_id is null
        and published_at is null
      returning id
    `,
    [id, reason],
  );

  if (result.rowCount === 0) return null;
  return findPublicationJobById(id);
}

async function retryPublicationJob(id: string) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        status = 'approved',
        error_message = null,
        updated_at = now()
      where id = $1
        and status = 'failed'
        and external_post_id is null
        and published_at is null
      returning id
    `,
    [id],
  );

  if (result.rowCount === 0) return null;
  return findPublicationJobById(id);
}

async function resetPublicationJobToReview(id: string) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        status = 'pending_review',
        error_message = null,
        updated_at = now()
      where id = $1
        and status in ('rejected', 'failed')
        and external_post_id is null
        and published_at is null
      returning id
    `,
    [id],
  );

  if (result.rowCount === 0) return null;
  return findPublicationJobById(id);
}

async function archivePublicationJob(id: string) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        status = 'archived',
        updated_at = now()
      where id = $1
        and status <> 'publishing'
      returning id
    `,
    [id],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findPublicationJobById(id);
}

async function updatePublicationJobContent(id: string, content: string) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        adapted_content = $2,
        status = case
          when status in ('rejected', 'failed') then 'pending_review'
          else status
        end,
        error_message = null,
        updated_at = now()
      where id = $1
        and status in ('pending', 'pending_review', 'rejected', 'failed')
        and external_post_id is null
        and published_at is null
      returning id
    `,
    [id, content],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findPublicationJobById(id);
}

export async function registerPublicationJobRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: PublicationJobsQuery }>(
    "/publication-jobs",
    { preHandler: requireAdminToken },
    async (request) => {
      const limit = parseLimit(request.query.limit);
      const order = parseOrder(request.query.order);
      const values: unknown[] = [];
      const clauses: string[] = [];

      if (request.query.status) {
        values.push(request.query.status);
        clauses.push(`j.status = $${values.length}`);
      } else if (request.query.view === "todo") {
        clauses.push("j.status in ('pending', 'pending_review', 'failed')");
      } else if (request.query.view === "archived") {
        clauses.push("j.status = 'archived'");
      } else {
        clauses.push("j.status <> 'archived'");
      }

      if (request.query.platform) {
        values.push(request.query.platform);
        clauses.push(`j.platform = $${values.length}`);
      }

      values.push(limit);

      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const limitPlaceholder = `$${values.length}`;

      const result = await pool.query(
        `
          ${PUBLICATION_JOB_SELECT}
          ${where}
          order by j.created_at ${order}
          limit ${limitPlaceholder}
        `,
        values,
      );

      return {
        count: result.rowCount,
        order,
        view: request.query.status ? null : request.query.view ?? "active",
        jobs: result.rows.map(rowToPublicationJob),
      };
    },
  );

  app.get<{ Querystring: Pick<PublicationJobsQuery, "order"> }>(
    "/publication-jobs/pending",
    { preHandler: requireAdminToken },
    async (request) => {
      const order = parseOrder(request.query.order);
      const result = await pool.query(
        `
          ${PUBLICATION_JOB_SELECT}
          where j.status in ('pending', 'pending_review')
          order by j.created_at ${order}
          limit 100
        `,
      );

      return {
        count: result.rowCount,
        order,
        jobs: result.rows.map(rowToPublicationJob),
      };
    },
  );

  app.post<{ Body: ManualDraftBody }>(
    "/publication-jobs/manual-draft",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const content = request.body?.content?.trim();
      const platforms = parseManualPlatforms(request.body?.platforms);

      if (!content) {
        return reply.code(400).send({ error: "invalid_content", message: "Content cannot be empty" });
      }

      if (platforms.length === 0) {
        return reply.code(400).send({
          error: "invalid_platforms",
          message: "At least one supported platform is required",
        });
      }

      const jobs = await createManualDraftJobs(content, platforms);

      return {
        count: jobs.length,
        jobs,
      };
    },
  );

  app.get<{ Params: PublicationJobParams }>(
    "/publication-jobs/:id",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await findPublicationJobById(request.params.id);

      if (!job) {
        return reply.code(404).send({ error: "not_found", message: "Publication job not found" });
      }

      return { job };
    },
  );

  app.get<{ Params: PublicationJobParams; Querystring: Pick<PublicationJobsQuery, "order"> }>(
    "/publication-jobs/:id/runs",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await findPublicationJobById(request.params.id);

      if (!job) {
        return reply.code(404).send({ error: "not_found", message: "Publication job not found" });
      }

      const order = parseOrder(request.query.order);
      const result = await pool.query(
        `
          select
            id,
            job_id,
            platform,
            status,
            mode,
            external_post_id,
            error_message,
            started_at,
            finished_at,
            raw_response
          from publication_job_runs
          where job_id = $1
          order by started_at ${order}
        `,
        [request.params.id],
      );

      return {
        count: result.rowCount,
        order,
        runs: result.rows.map(rowToPublicationJobRun),
      };
    },
  );

  app.post<{ Params: PublicationJobParams; Body: UpdateContentBody }>(
    "/publication-jobs/:id/content",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const content = request.body?.content?.trim();

      if (!content) {
        return reply.code(400).send({ error: "invalid_content", message: "Content cannot be empty" });
      }

      const job = await updatePublicationJobContent(request.params.id, content);

      if (!job) {
        return reply.code(409).send({
          error: "content_not_editable",
          message: "Only unpublished pending, pending_review, rejected or failed jobs can be edited",
        });
      }

      return { job };
    },
  );

  app.post<{ Params: PublicationJobParams }>(
    "/publication-jobs/:id/approve",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await approvePublicationJob(request.params.id);

      if (!job) {
        return reply.code(409).send({
          error: "job_not_approvable",
          message: "Only unpublished pending or pending_review jobs can be approved",
        });
      }

      return { job };
    },
  );

  app.post<{ Params: PublicationJobParams; Body: RejectBody }>(
    "/publication-jobs/:id/reject",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const reason = request.body?.reason?.trim() || "Rejected from API";
      const job = await rejectPublicationJob(request.params.id, reason);

      if (!job) {
        return reply.code(409).send({
          error: "job_not_rejectable",
          message: "Only unpublished pending, pending_review or approved jobs can be rejected",
        });
      }

      return { job };
    },
  );

  app.post<{ Params: PublicationJobParams }>(
    "/publication-jobs/:id/retry",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await retryPublicationJob(request.params.id);

      if (!job) {
        return reply.code(409).send({
          error: "job_not_retryable",
          message: "Only unpublished failed jobs can be retried",
        });
      }

      return { job };
    },
  );

  app.post<{ Params: PublicationJobParams }>(
    "/publication-jobs/:id/reset-review",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await resetPublicationJobToReview(request.params.id);

      if (!job) {
        return reply.code(409).send({
          error: "job_not_resettable",
          message: "Only unpublished rejected or failed jobs can be reset to pending_review",
        });
      }

      return { job };
    },
  );

  app.post<{ Params: PublicationJobParams }>(
    "/publication-jobs/:id/archive",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await archivePublicationJob(request.params.id);

      if (!job) {
        return reply.code(409).send({
          error: "job_not_archivable",
          message: "Publication job not found or currently publishing",
        });
      }

      return { job };
    },
  );
}
