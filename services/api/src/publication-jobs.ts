import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type PublicationJobStatus =
  | "pending"
  | "pending_review"
  | "drafted"
  | "approved"
  | "rejected"
  | "published"
  | "failed";

type SortOrder = "asc" | "desc";

type PublicationJobsQuery = {
  status?: PublicationJobStatus;
  platform?: string;
  limit?: string;
  order?: SortOrder;
};

type PublicationJobParams = {
  id: string;
};

type RejectBody = {
  reason?: string;
};

const PUBLICATION_JOB_SELECT = `
  select
    j.id,
    j.source_event_id,
    j.platform,
    j.status,
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

function rowToPublicationJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    platform: row.platform,
    status: row.status,
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

async function updatePublicationJobStatus(
  id: string,
  status: Extract<PublicationJobStatus, "approved" | "rejected">,
  errorMessage: string | null = null,
) {
  await pool.query(
    `
      update publication_jobs
      set
        status = $2,
        error_message = $3,
        updated_at = now()
      where id = $1
    `,
    [id, status, errorMessage],
  );

  return findPublicationJobById(id);
}

export async function registerPublicationJobRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: PublicationJobsQuery }>("/publication-jobs", async (request) => {
    const limit = parseLimit(request.query.limit);
    const order = parseOrder(request.query.order);
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (request.query.status) {
      values.push(request.query.status);
      clauses.push(`j.status = $${values.length}`);
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
      jobs: result.rows.map(rowToPublicationJob),
    };
  });

  app.get<{ Querystring: Pick<PublicationJobsQuery, "order"> }>("/publication-jobs/pending", async (request) => {
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
  });

  app.get<{ Params: PublicationJobParams }>("/publication-jobs/:id", async (request, reply) => {
    const job = await findPublicationJobById(request.params.id);

    if (!job) {
      return reply.code(404).send({ error: "not_found", message: "Publication job not found" });
    }

    return { job };
  });

  app.get<{ Params: PublicationJobParams; Querystring: Pick<PublicationJobsQuery, "order"> }>(
    "/publication-jobs/:id/runs",
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

  app.post<{ Params: PublicationJobParams }>(
    "/publication-jobs/:id/approve",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await updatePublicationJobStatus(request.params.id, "approved");

      if (!job) {
        return reply.code(404).send({ error: "not_found", message: "Publication job not found" });
      }

      return { job };
    },
  );

  app.post<{ Params: PublicationJobParams; Body: RejectBody }>(
    "/publication-jobs/:id/reject",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const reason = request.body?.reason?.trim() || "Rejected from API";
      const job = await updatePublicationJobStatus(request.params.id, "rejected", reason);

      if (!job) {
        return reply.code(404).send({ error: "not_found", message: "Publication job not found" });
      }

      return { job };
    },
  );
}
