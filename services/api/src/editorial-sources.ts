import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type EditorialSourceStatus = "new" | "ignored" | "archived";
type SortOrder = "asc" | "desc";

type EditorialSourcesQuery = {
  provider?: string;
  status?: EditorialSourceStatus;
  order?: SortOrder;
  limit?: string;
};

type EditorialSourceParams = {
  id: string;
};

const ALLOWED_STATUSES = new Set<EditorialSourceStatus>(["new", "ignored", "archived"]);

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseOrder(value: string | undefined): SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function rowToEditorialSourceItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    sourceUrl: row.source_url,
    title: row.title,
    excerpt: row.excerpt,
    status: row.status,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findEditorialSourceItemById(id: string) {
  const result = await pool.query(
    `select id, provider, source_url, title, excerpt, status, published_at, fetched_at, metadata, created_at, updated_at from editorial_source_items where id = $1 limit 1`,
    [id],
  );
  return result.rows[0] ? rowToEditorialSourceItem(result.rows[0]) : null;
}

async function updateEditorialSourceStatus(id: string, status: EditorialSourceStatus) {
  const result = await pool.query(
    `update editorial_source_items set status = $2, updated_at = now() where id = $1 returning id`,
    [id, status],
  );
  if (result.rowCount === 0) return null;
  return findEditorialSourceItemById(id);
}

export async function registerEditorialSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: EditorialSourcesQuery }>("/editorial-sources", { preHandler: requireAdminToken }, async (request, reply) => {
    const values: unknown[] = [];
    const clauses: string[] = [];
    const limit = parseLimit(request.query.limit);
    const order = parseOrder(request.query.order);

    if (request.query.provider) {
      values.push(request.query.provider.trim().toLowerCase());
      clauses.push(`provider = $${values.length}`);
    }

    if (request.query.status) {
      if (!ALLOWED_STATUSES.has(request.query.status)) {
        return reply.code(400).send({ error: "invalid_status", message: "Unsupported source status" });
      }
      values.push(request.query.status);
      clauses.push(`status = $${values.length}`);
    }

    values.push(limit);
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const limitPlaceholder = `$${values.length}`;

    const result = await pool.query(
      `select id, provider, source_url, title, excerpt, status, published_at, fetched_at, metadata, created_at, updated_at from editorial_source_items ${where} order by fetched_at ${order}, created_at ${order} limit ${limitPlaceholder}`,
      values,
    );

    return { count: result.rowCount, order, sources: result.rows.map(rowToEditorialSourceItem) };
  });

  app.get<{ Params: EditorialSourceParams }>("/editorial-sources/:id", { preHandler: requireAdminToken }, async (request, reply) => {
    const source = await findEditorialSourceItemById(request.params.id);
    if (!source) return reply.code(404).send({ error: "not_found", message: "Editorial source not found" });
    return { source };
  });

  app.post<{ Params: EditorialSourceParams }>("/editorial-sources/:id/ignore", { preHandler: requireAdminToken }, async (request, reply) => {
    const source = await updateEditorialSourceStatus(request.params.id, "ignored");
    if (!source) return reply.code(404).send({ error: "not_found", message: "Editorial source not found" });
    return { source };
  });

  app.post<{ Params: EditorialSourceParams }>("/editorial-sources/:id/archive", { preHandler: requireAdminToken }, async (request, reply) => {
    const source = await updateEditorialSourceStatus(request.params.id, "archived");
    if (!source) return reply.code(404).send({ error: "not_found", message: "Editorial source not found" });
    return { source };
  });

  app.post<{ Params: EditorialSourceParams }>("/editorial-sources/:id/reset", { preHandler: requireAdminToken }, async (request, reply) => {
    const source = await updateEditorialSourceStatus(request.params.id, "new");
    if (!source) return reply.code(404).send({ error: "not_found", message: "Editorial source not found" });
    return { source };
  });
}
