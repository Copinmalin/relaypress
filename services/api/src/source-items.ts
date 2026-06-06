import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type SourceItemStatus = "new" | "selected" | "ignored" | "archived" | "failed";
type SortOrder = "asc" | "desc";

type SourceItemsQuery = {
  provider?: string;
  status?: SourceItemStatus;
  limit?: string;
  order?: SortOrder;
};

type SourceItemParams = {
  id: string;
};

const SOURCE_ITEM_STATUSES = new Set<SourceItemStatus>(["new", "selected", "ignored", "archived", "failed"]);
const EDITABLE_SOURCE_ITEM_STATUSES = new Set<SourceItemStatus>(["selected", "ignored", "archived"]);

const SOURCE_ITEM_SELECT = `
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

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseOrder(value: string | undefined): SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function isSourceItemStatus(value: string | undefined): value is SourceItemStatus {
  return Boolean(value && SOURCE_ITEM_STATUSES.has(value as SourceItemStatus));
}

function rowToSourceItem(row: Record<string, unknown>) {
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

async function findSourceItemById(id: string) {
  const result = await pool.query(
    `
      ${SOURCE_ITEM_SELECT}
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ? rowToSourceItem(result.rows[0]) : null;
}

async function updateSourceItemStatus(id: string, status: SourceItemStatus) {
  const result = await pool.query(
    `
      update source_items
      set
        status = $2,
        updated_at = now()
      where id = $1
      returning id
    `,
    [id, status],
  );

  if (result.rowCount === 0) return null;
  return findSourceItemById(id);
}

export async function registerSourceItemRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SourceItemsQuery }>(
    "/source-items",
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
        if (!isSourceItemStatus(request.query.status)) {
          return reply.code(400).send({
            error: "invalid_status",
            message: "Unsupported source item status",
          });
        }

        values.push(request.query.status);
        clauses.push(`status = $${values.length}`);
      }

      values.push(limit);

      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const limitPlaceholder = `$${values.length}`;

      const result = await pool.query(
        `
          ${SOURCE_ITEM_SELECT}
          ${where}
          order by fetched_at ${order}, created_at ${order}
          limit ${limitPlaceholder}
        `,
        values,
      );

      return {
        count: result.rowCount,
        order,
        items: result.rows.map(rowToSourceItem),
      };
    },
  );

  app.get<{ Params: SourceItemParams }>(
    "/source-items/:id",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const item = await findSourceItemById(request.params.id);

      if (!item) {
        return reply.code(404).send({ error: "not_found", message: "Source item not found" });
      }

      return { item };
    },
  );

  for (const status of EDITABLE_SOURCE_ITEM_STATUSES) {
    app.post<{ Params: SourceItemParams }>(
      `/source-items/:id/${status}`,
      { preHandler: requireAdminToken },
      async (request, reply) => {
        const item = await updateSourceItemStatus(request.params.id, status);

        if (!item) {
          return reply.code(404).send({ error: "not_found", message: "Source item not found" });
        }

        return { item };
      },
    );
  }
}
