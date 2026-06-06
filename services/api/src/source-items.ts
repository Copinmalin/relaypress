import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type SourceItemStatus = "new" | "selected" | "ignored" | "archived" | "failed";
type EditorialSignalStatus = "qualified" | "needs_sources" | "ready_for_campaign" | "ignored" | "archived";
type EditorialSignalRiskLevel = "low" | "medium" | "high";
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

type CreateEditorialSignalBody = {
  category?: string;
  summaryInternal?: string;
  editorialAngle?: string;
  riskLevel?: EditorialSignalRiskLevel;
  primarySources?: string[];
  status?: EditorialSignalStatus;
};

type ParsedEditorialSignal = {
  category: string;
  summaryInternal: string;
  editorialAngle: string;
  riskLevel: EditorialSignalRiskLevel;
  primarySources: string[];
  status: EditorialSignalStatus;
};

const SOURCE_ITEM_STATUSES = new Set<SourceItemStatus>(["new", "selected", "ignored", "archived", "failed"]);
const EDITABLE_SOURCE_ITEM_STATUSES = new Set<SourceItemStatus>(["selected", "ignored", "archived"]);
const EDITORIAL_SIGNAL_STATUSES = new Set<EditorialSignalStatus>([
  "qualified",
  "needs_sources",
  "ready_for_campaign",
  "ignored",
  "archived",
]);
const EDITORIAL_SIGNAL_RISK_LEVELS = new Set<EditorialSignalRiskLevel>(["low", "medium", "high"]);

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

function isEditorialSignalStatus(value: string | undefined): value is EditorialSignalStatus {
  return Boolean(value && EDITORIAL_SIGNAL_STATUSES.has(value as EditorialSignalStatus));
}

function isEditorialSignalRiskLevel(value: string | undefined): value is EditorialSignalRiskLevel {
  return Boolean(value && EDITORIAL_SIGNAL_RISK_LEVELS.has(value as EditorialSignalRiskLevel));
}

function normalizePrimarySources(value: string[] | undefined): string[] {
  return [...new Set((value ?? []).map((source) => source.trim()).filter(Boolean))];
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

function rowToEditorialSignal(row: Record<string, unknown>) {
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

async function findEditorialSignalById(id: string) {
  const result = await pool.query(
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
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ? rowToEditorialSignal(result.rows[0]) : null;
}

function parseEditorialSignalBody(body: CreateEditorialSignalBody | undefined): ParsedEditorialSignal | string {
  const category = body?.category?.trim();
  const summaryInternal = body?.summaryInternal?.trim();
  const editorialAngle = body?.editorialAngle?.trim();
  const riskLevel = body?.riskLevel ?? "medium";
  const status = body?.status ?? "qualified";

  if (!category) return "Category is required";
  if (!summaryInternal) return "Internal summary is required";
  if (!editorialAngle) return "Editorial angle is required";
  if (!isEditorialSignalRiskLevel(riskLevel)) return "Unsupported editorial signal risk level";
  if (!isEditorialSignalStatus(status)) return "Unsupported editorial signal status";

  return {
    category,
    summaryInternal,
    editorialAngle,
    riskLevel,
    primarySources: normalizePrimarySources(body?.primarySources),
    status,
  };
}

async function createEditorialSignal(sourceItemId: string, signal: ParsedEditorialSignal) {
  const id = randomUUID();

  await pool.query(
    `
      insert into editorial_signals (
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
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, now(), now())
    `,
    [
      id,
      sourceItemId,
      signal.category,
      signal.summaryInternal,
      signal.editorialAngle,
      signal.riskLevel,
      signal.status,
      JSON.stringify(signal.primarySources),
    ],
  );

  return findEditorialSignalById(id);
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

  app.post<{ Params: SourceItemParams; Body: CreateEditorialSignalBody }>(
    "/source-items/:id/editorial-signals",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const item = await findSourceItemById(request.params.id);

      if (!item) {
        return reply.code(404).send({ error: "not_found", message: "Source item not found" });
      }

      if (item.status !== "selected") {
        return reply.code(409).send({
          error: "source_item_not_selected",
          message: "Only selected source items can be qualified as editorial signals",
        });
      }

      const parsedSignal = parseEditorialSignalBody(request.body);
      if (typeof parsedSignal === "string") {
        return reply.code(400).send({ error: "invalid_signal", message: parsedSignal });
      }

      const signal = await createEditorialSignal(request.params.id, parsedSignal);
      return reply.code(201).send({ signal });
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
