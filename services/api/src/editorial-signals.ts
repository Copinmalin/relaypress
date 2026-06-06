import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type EditorialSignalStatus = "qualified" | "needs_sources" | "ready_for_campaign" | "ignored" | "archived";
type EditorialSignalRiskLevel = "low" | "medium" | "high";
type SortOrder = "asc" | "desc";

type EditorialSignalsQuery = {
  sourceItemId?: string;
  category?: string;
  status?: EditorialSignalStatus;
  riskLevel?: EditorialSignalRiskLevel;
  limit?: string;
  order?: SortOrder;
};

type EditorialSignalParams = {
  id: string;
};

type SourceItemSignalParams = {
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

type ValidatedCreateEditorialSignalBody = {
  category: string;
  summaryInternal: string;
  editorialAngle: string;
  riskLevel: EditorialSignalRiskLevel;
  primarySources: string[];
  status: EditorialSignalStatus;
};

type UpdateEditorialSignalStatusBody = {
  status?: EditorialSignalStatus;
};

const EDITORIAL_SIGNAL_STATUSES = new Set<EditorialSignalStatus>([
  "qualified",
  "needs_sources",
  "ready_for_campaign",
  "ignored",
  "archived",
]);

const EDITORIAL_SIGNAL_RISK_LEVELS = new Set<EditorialSignalRiskLevel>(["low", "medium", "high"]);

const EDITORIAL_SIGNAL_SELECT = `
  select
    s.id,
    s.source_item_id,
    s.category,
    s.summary_internal,
    s.editorial_angle,
    s.risk_level,
    s.status,
    s.primary_sources,
    s.metadata,
    s.created_at,
    s.updated_at,
    i.provider as source_provider,
    i.source_url,
    i.canonical_url,
    i.title as source_title,
    i.excerpt as source_excerpt,
    i.language as source_language,
    i.status as source_status,
    i.fetched_at as source_fetched_at
  from editorial_signals s
  join source_items i on i.id = s.source_item_id
`;

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseOrder(value: string | undefined): SortOrder {
  return value === "asc" ? "asc" : "desc";
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
    sourceItem: {
      id: row.source_item_id,
      provider: row.source_provider,
      sourceUrl: row.source_url,
      canonicalUrl: row.canonical_url,
      title: row.source_title,
      excerpt: row.source_excerpt,
      language: row.source_language,
      status: row.source_status,
      fetchedAt: row.source_fetched_at,
    },
  };
}

async function findEditorialSignalById(id: string) {
  const result = await pool.query(
    `
      ${EDITORIAL_SIGNAL_SELECT}
      where s.id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ? rowToEditorialSignal(result.rows[0]) : null;
}

async function sourceItemExists(id: string): Promise<boolean> {
  const result = await pool.query(
    `
      select id
      from source_items
      where id = $1
      limit 1
    `,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

async function createEditorialSignal(sourceItemId: string, body: ValidatedCreateEditorialSignalBody) {
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
      body.category,
      body.summaryInternal,
      body.editorialAngle,
      body.riskLevel,
      body.status,
      JSON.stringify(body.primarySources),
    ],
  );

  return findEditorialSignalById(id);
}

async function updateEditorialSignalStatus(id: string, status: EditorialSignalStatus) {
  const result = await pool.query(
    `
      update editorial_signals
      set
        status = $2,
        updated_at = now()
      where id = $1
      returning id
    `,
    [id, status],
  );

  if (result.rowCount === 0) return null;
  return findEditorialSignalById(id);
}

function parseCreateBody(body: CreateEditorialSignalBody | undefined): ValidatedCreateEditorialSignalBody | string {
  const category = body?.category?.trim();
  const summaryInternal = body?.summaryInternal?.trim();
  const editorialAngle = body?.editorialAngle?.trim();
  const status = body?.status ?? "qualified";
  const riskLevel = body?.riskLevel ?? "medium";

  if (!category) return "Category is required";
  if (!summaryInternal) return "Internal summary is required";
  if (!editorialAngle) return "Editorial angle is required";
  if (!isEditorialSignalStatus(status)) return "Unsupported editorial signal status";
  if (!isEditorialSignalRiskLevel(riskLevel)) return "Unsupported editorial signal risk level";
  if (body?.primarySources && !Array.isArray(body.primarySources)) return "Primary sources must be an array";

  return {
    category,
    summaryInternal,
    editorialAngle,
    riskLevel,
    primarySources: normalizePrimarySources(body?.primarySources),
    status,
  };
}

export async function registerEditorialSignalRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: EditorialSignalsQuery }>(
    "/editorial-signals",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const limit = parseLimit(request.query.limit);
      const order = parseOrder(request.query.order);
      const values: unknown[] = [];
      const clauses: string[] = [];

      if (request.query.sourceItemId) {
        values.push(request.query.sourceItemId.trim());
        clauses.push(`s.source_item_id = $${values.length}`);
      }

      if (request.query.category) {
        values.push(request.query.category.trim());
        clauses.push(`s.category = $${values.length}`);
      }

      if (request.query.status) {
        if (!isEditorialSignalStatus(request.query.status)) {
          return reply.code(400).send({ error: "invalid_status", message: "Unsupported editorial signal status" });
        }

        values.push(request.query.status);
        clauses.push(`s.status = $${values.length}`);
      }

      if (request.query.riskLevel) {
        if (!isEditorialSignalRiskLevel(request.query.riskLevel)) {
          return reply.code(400).send({ error: "invalid_risk_level", message: "Unsupported editorial signal risk level" });
        }

        values.push(request.query.riskLevel);
        clauses.push(`s.risk_level = $${values.length}`);
      }

      values.push(limit);

      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const limitPlaceholder = `$${values.length}`;

      const result = await pool.query(
        `
          ${EDITORIAL_SIGNAL_SELECT}
          ${where}
          order by s.created_at ${order}
          limit ${limitPlaceholder}
        `,
        values,
      );

      return {
        count: result.rowCount,
        order,
        signals: result.rows.map(rowToEditorialSignal),
      };
    },
  );

  app.get<{ Params: EditorialSignalParams }>(
    "/editorial-signals/:id",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const signal = await findEditorialSignalById(request.params.id);

      if (!signal) {
        return reply.code(404).send({ error: "not_found", message: "Editorial signal not found" });
      }

      return { signal };
    },
  );

  app.post<{ Params: SourceItemSignalParams; Body: CreateEditorialSignalBody }>(
    "/source-items/:id/editorial-signals",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const parsedBody = parseCreateBody(request.body);
      if (typeof parsedBody === "string") {
        return reply.code(400).send({ error: "invalid_signal", message: parsedBody });
      }

      if (!(await sourceItemExists(request.params.id))) {
        return reply.code(404).send({ error: "not_found", message: "Source item not found" });
      }

      const signal = await createEditorialSignal(request.params.id, parsedBody);

      return reply.code(201).send({ signal });
    },
  );

  app.post<{ Params: EditorialSignalParams; Body: UpdateEditorialSignalStatusBody }>(
    "/editorial-signals/:id/status",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const status = request.body?.status;

      if (!isEditorialSignalStatus(status)) {
        return reply.code(400).send({ error: "invalid_status", message: "Unsupported editorial signal status" });
      }

      const signal = await updateEditorialSignalStatus(request.params.id, status);

      if (!signal) {
        return reply.code(404).send({ error: "not_found", message: "Editorial signal not found" });
      }

      return { signal };
    },
  );
}
