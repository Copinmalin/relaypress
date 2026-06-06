import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type EditorialSignalStatus = "qualified" | "needs_sources" | "ready_for_campaign" | "ignored" | "archived";
type EditorialSignalRiskLevel = "low" | "medium" | "high";

const statuses = new Set<EditorialSignalStatus>(["qualified", "needs_sources", "ready_for_campaign", "ignored", "archived"]);
const riskLevels = new Set<EditorialSignalRiskLevel>(["low", "medium", "high"]);

const selectSignal = `
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

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isStatus(value: unknown): value is EditorialSignalStatus {
  return typeof value === "string" && statuses.has(value as EditorialSignalStatus);
}

function isRisk(value: unknown): value is EditorialSignalRiskLevel {
  return typeof value === "string" && riskLevels.has(value as EditorialSignalRiskLevel);
}

function limit(value: unknown): number {
  const parsed = Number(value ?? 50);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 200) : 50;
}

function order(value: unknown): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

function sources(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(str).filter((item): item is string => Boolean(item)))];
}

function row(rowData: Record<string, unknown>) {
  return {
    id: rowData.id,
    sourceItemId: rowData.source_item_id,
    category: rowData.category,
    summaryInternal: rowData.summary_internal,
    editorialAngle: rowData.editorial_angle,
    riskLevel: rowData.risk_level,
    status: rowData.status,
    primarySources: rowData.primary_sources,
    metadata: rowData.metadata,
    createdAt: rowData.created_at,
    updatedAt: rowData.updated_at,
    sourceItem: {
      id: rowData.source_item_id,
      provider: rowData.source_provider,
      sourceUrl: rowData.source_url,
      canonicalUrl: rowData.canonical_url,
      title: rowData.source_title,
      excerpt: rowData.source_excerpt,
      language: rowData.source_language,
      status: rowData.source_status,
      fetchedAt: rowData.source_fetched_at,
    },
  };
}

async function findSignal(id: string) {
  const result = await pool.query(`${selectSignal} where s.id = $1 limit 1`, [id]);
  return result.rows[0] ? row(result.rows[0]) : null;
}

async function sourceItemExists(id: string): Promise<boolean> {
  const result = await pool.query("select id from source_items where id = $1 limit 1", [id]);
  return (result.rowCount ?? 0) > 0;
}

function parseBody(value: unknown) {
  if (!value || typeof value !== "object") return "Request body is required";

  const body = value as Record<string, unknown>;
  const category = str(body.category);
  const summaryInternal = str(body.summaryInternal);
  const editorialAngle = str(body.editorialAngle);
  const status = body.status ?? "qualified";
  const riskLevel = body.riskLevel ?? "medium";

  if (!category) return "Category is required";
  if (!summaryInternal) return "Internal summary is required";
  if (!editorialAngle) return "Editorial angle is required";
  if (!isStatus(status)) return "Unsupported editorial signal status";
  if (!isRisk(riskLevel)) return "Unsupported editorial signal risk level";
  if (body.primarySources && !Array.isArray(body.primarySources)) return "Primary sources must be an array";

  return { category, summaryInternal, editorialAngle, status, riskLevel, primarySources: sources(body.primarySources) };
}

async function createSignal(sourceItemId: string, body: ReturnType<typeof parseBody>) {
  if (typeof body === "string") throw new Error(body);
  const id = randomUUID();
  await pool.query(
    `insert into editorial_signals (id, source_item_id, category, summary_internal, editorial_angle, risk_level, status, primary_sources, metadata, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, now(), now())`,
    [id, sourceItemId, body.category, body.summaryInternal, body.editorialAngle, body.riskLevel, body.status, JSON.stringify(body.primarySources)],
  );
  return findSignal(id);
}

export async function registerEditorialSignalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/editorial-signals", { preHandler: requireAdminToken }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const values: unknown[] = [];
    const clauses: string[] = [];
    const sourceItemId = str(query.sourceItemId);
    const category = str(query.category);

    if (sourceItemId) {
      values.push(sourceItemId);
      clauses.push(`s.source_item_id = $${values.length}`);
    }

    if (category) {
      values.push(category);
      clauses.push(`s.category = $${values.length}`);
    }

    if (query.status) {
      if (!isStatus(query.status)) return reply.code(400).send({ error: "invalid_status", message: "Unsupported editorial signal status" });
      values.push(query.status);
      clauses.push(`s.status = $${values.length}`);
    }

    if (query.riskLevel) {
      if (!isRisk(query.riskLevel)) return reply.code(400).send({ error: "invalid_risk_level", message: "Unsupported editorial signal risk level" });
      values.push(query.riskLevel);
      clauses.push(`s.risk_level = $${values.length}`);
    }

    values.push(limit(query.limit));
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await pool.query(`${selectSignal} ${where} order by s.created_at ${order(query.order)} limit $${values.length}`, values);

    return { count: result.rowCount, signals: result.rows.map(row) };
  });

  app.get("/editorial-signals/:id", { preHandler: requireAdminToken }, async (request, reply) => {
    const id = str((request.params as Record<string, unknown>).id);
    if (!id) return reply.code(400).send({ error: "invalid_id", message: "Editorial signal id is required" });
    const signal = await findSignal(id);
    return signal ? { signal } : reply.code(404).send({ error: "not_found", message: "Editorial signal not found" });
  });

  app.post("/source-items/:id/editorial-signals", { preHandler: requireAdminToken }, async (request, reply) => {
    const sourceItemId = str((request.params as Record<string, unknown>).id);
    if (!sourceItemId) return reply.code(400).send({ error: "invalid_id", message: "Source item id is required" });
    const parsed = parseBody(request.body);
    if (typeof parsed === "string") return reply.code(400).send({ error: "invalid_signal", message: parsed });
    if (!(await sourceItemExists(sourceItemId))) return reply.code(404).send({ error: "not_found", message: "Source item not found" });
    const signal = await createSignal(sourceItemId, parsed);
    return reply.code(201).send({ signal });
  });

  app.post("/editorial-signals/:id/status", { preHandler: requireAdminToken }, async (request, reply) => {
    const id = str((request.params as Record<string, unknown>).id);
    const status = (request.body as Record<string, unknown> | undefined)?.status;
    if (!id) return reply.code(400).send({ error: "invalid_id", message: "Editorial signal id is required" });
    if (!isStatus(status)) return reply.code(400).send({ error: "invalid_status", message: "Unsupported editorial signal status" });

    const result = await pool.query("update editorial_signals set status = $2, updated_at = now() where id = $1 returning id", [id, status]);
    if (result.rowCount === 0) return reply.code(404).send({ error: "not_found", message: "Editorial signal not found" });
    return { signal: await findSignal(id) };
  });
}
