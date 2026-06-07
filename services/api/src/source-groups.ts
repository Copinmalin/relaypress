import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type SourceGroupQuery = {
  provider?: string;
  status?: string;
  limit?: string;
  order?: "asc" | "desc";
};

const SOURCE_SELECT = `
  select
    id,
    provider,
    source_url,
    canonical_url,
    title,
    excerpt,
    language,
    status,
    metadata,
    fetched_at,
    created_at,
    updated_at
  from source_items
`;

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function parseOrder(value: string | undefined): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

function toSource(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    sourceUrl: row.source_url,
    canonicalUrl: row.canonical_url,
    title: row.title,
    excerpt: row.excerpt,
    language: row.language,
    status: row.status,
    metadata: row.metadata,
    fetchedAt: row.fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSignal(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceItemId: row.source_item_id,
    category: row.category,
    summaryInternal: row.summary_internal,
    editorialAngle: row.editorial_angle,
    riskLevel: row.risk_level,
    status: row.status,
    primarySources: row.primary_sources,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceItemId: row.source_item_id,
    editorialSignalId: row.editorial_signal_id,
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
  };
}

function groupRowsBySource(rows: Record<string, unknown>[], key: "source_item_id") {
  const grouped = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const id = String(row[key] ?? "");
    if (!id) continue;
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  }

  return grouped;
}

export async function registerSourceGroupRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SourceGroupQuery }>(
    "/source-groups",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const order = parseOrder(request.query.order);
      const values: unknown[] = [];
      const clauses: string[] = [];

      if (request.query.provider) {
        values.push(request.query.provider.trim());
        clauses.push(`provider = $${values.length}`);
      }

      if (request.query.status) {
        values.push(request.query.status.trim());
        clauses.push(`status = $${values.length}`);
      }

      values.push(limit);
      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const sourceResult = await pool.query(
        `
          ${SOURCE_SELECT}
          ${where}
          order by fetched_at ${order}, created_at ${order}
          limit $${values.length}
        `,
        values,
      );

      const sourceIds = sourceResult.rows.map((row) => String(row.id));

      if (sourceIds.length === 0) {
        return { count: 0, order, groups: [] };
      }

      const [signalsResult, jobsResult] = await Promise.all([
        pool.query(
          `
            select
              id,
              source_item_id,
              category,
              summary_internal,
              editorial_angle,
              risk_level,
              status,
              primary_sources,
              metadata,
              created_at,
              updated_at
            from editorial_signals
            where source_item_id = any($1::varchar[])
            order by created_at desc
          `,
          [sourceIds],
        ),
        pool.query(
          `
            select
              id,
              source_item_id,
              editorial_signal_id,
              platform,
              status,
              source_content,
              adapted_content,
              external_post_id,
              error_message,
              scheduled_at,
              published_at,
              created_at,
              updated_at
            from publication_jobs
            where source_item_id = any($1::varchar[])
            order by created_at desc
          `,
          [sourceIds],
        ),
      ]);

      const signalsBySource = groupRowsBySource(signalsResult.rows, "source_item_id");
      const jobsBySource = groupRowsBySource(jobsResult.rows, "source_item_id");

      return {
        count: sourceResult.rowCount,
        order,
        groups: sourceResult.rows.map((sourceRow) => {
          const sourceId = String(sourceRow.id);
          return {
            sourceItem: toSource(sourceRow),
            editorialSignals: (signalsBySource.get(sourceId) ?? []).map(toSignal),
            publicationJobs: (jobsBySource.get(sourceId) ?? []).map(toJob),
          };
        }),
      };
    },
  );
}
