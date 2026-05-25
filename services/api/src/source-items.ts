import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type SourceItemsQuery = {
  provider?: string;
  status?: string;
  limit?: string;
};

type SourceItemParams = {
  id: string;
};

const SOURCE_ITEM_STATUSES = new Set(["imported", "selected", "ignored", "converted"]);

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function normalizeStatus(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return SOURCE_ITEM_STATUSES.has(normalized) ? normalized : null;
}

function rowToSourceItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    sourceUrl: row.source_url,
    title: row.title,
    content: row.content,
    status: row.status,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findSourceItemById(id: string) {
  const result = await pool.query(
    [
      "select id, provider, source_url, title, content, status, metadata, created_at, updated_at",
      "from source_items",
      "where id = $1",
      "limit 1",
    ].join("\n"),
    [id],
  );

  return result.rows[0] ? rowToSourceItem(result.rows[0]) : null;
}

async function updateSourceItemStatus(id: string, status: string) {
  const result = await pool.query(
    [
      "update source_items",
      "set status = $2, updated_at = now()",
      "where id = $1 and status <> 'converted'",
      "returning id",
    ].join("\n"),
    [id, status],
  );

  if (result.rowCount === 0) return null;
  return findSourceItemById(id);
}

export async function registerSourceItemRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SourceItemsQuery }>(
    "/source-items",
    { preHandler: requireAdminToken },
    async (request) => {
      const values: unknown[] = [];
      const clauses: string[] = [];
      const limit = parseLimit(request.query.limit);
      const status = normalizeStatus(request.query.status);

      if (request.query.provider) {
        values.push(request.query.provider.trim().toLowerCase());
        clauses.push(`provider = $${values.length}`);
      }

      if (status) {
        values.push(status);
        clauses.push(`status = $${values.length}`);
      }

      values.push(limit);
      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const limitPlaceholder = `$${values.length}`;

      const result = await pool.query(
        [
          "select id, provider, source_url, title, content, status, metadata, created_at, updated_at",
          "from source_items",
          where,
          "order by updated_at desc",
          `limit ${limitPlaceholder}`,
        ].join("\n"),
        values,
      );

      return {
        count: result.rowCount,
        items: result.rows.map(rowToSourceItem),
      };
    },
  );

  app.get<{ Params: SourceItemParams }>(
    "/source-items/:id",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const item = await findSourceItemById(request.params.id);
      if (!item) return reply.code(404).send({ error: "not_found", message: "Source item not found" });
      return { item };
    },
  );

  app.post<{ Params: SourceItemParams }>(
    "/source-items/:id/select",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const item = await updateSourceItemStatus(request.params.id, "selected");
      if (!item) return reply.code(409).send({ error: "source_item_not_selectable", message: "Source item not found or already converted" });
      return { item };
    },
  );

  app.post<{ Params: SourceItemParams }>(
    "/source-items/:id/ignore",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const item = await updateSourceItemStatus(request.params.id, "ignored");
      if (!item) return reply.code(409).send({ error: "source_item_not_ignorable", message: "Source item not found or already converted" });
      return { item };
    },
  );
}
