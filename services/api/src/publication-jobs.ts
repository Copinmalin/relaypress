import type { FastifyInstance } from "fastify";
import { pool } from "./db.js";

type PublicationJobStatus = "pending" | "pending_review" | "drafted" | "published" | "failed";

type PublicationJobsQuery = {
  status?: PublicationJobStatus;
  platform?: string;
  limit?: string;
};

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
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

export async function registerPublicationJobRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: PublicationJobsQuery }>("/publication-jobs", async (request) => {
    const limit = parseLimit(request.query.limit);
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
        ${where}
        order by j.created_at desc
        limit ${limitPlaceholder}
      `,
      values,
    );

    return {
      count: result.rowCount,
      jobs: result.rows.map(rowToPublicationJob),
    };
  });

  app.get("/publication-jobs/pending", async () => {
    const result = await pool.query(
      `
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
        where j.status in ('pending', 'pending_review')
        order by j.created_at desc
        limit 100
      `,
    );

    return {
      count: result.rowCount,
      jobs: result.rows.map(rowToPublicationJob),
    };
  });
}
