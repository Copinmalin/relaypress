import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { pool } from "./db.js";

type EditorialSignalStatus = "qualified" | "needs_sources" | "ready_for_campaign" | "ignored" | "archived";
type EditorialSignalRiskLevel = "low" | "medium" | "high";
type SourceItemSignalParams = { id: string };
type EditorialSignalParams = { id: string };
type CreateEditorialSignalBody = {
  category?: string;
  summaryInternal?: string;
  editorialAngle?: string;
  riskLevel?: EditorialSignalRiskLevel;
  primarySources?: string[];
  status?: EditorialSignalStatus;
};
type UpdateEditorialSignalStatusBody = { status?: EditorialSignalStatus };

const statuses = new Set<EditorialSignalStatus>(["qualified", "needs_sources", "ready_for_campaign", "ignored", "archived"]);
const risks = new Set<EditorialSignalRiskLevel>(["low", "medium", "high"]);
const selectSignal = "select s.id, s.source_item_id, s.category, s.summary_internal, s.editorial_angle, s.risk_level, s.status, s.primary_sources, s.metadata, s.created_at, s.updated_at, i.provider as source_provider, i.source_url, i.canonical_url, i.title as source_title, i.excerpt as source_excerpt, i.language as source_language, i.status as source_status, i.fetched_at as source_fetched_at from editorial_signals s join source_items i on i.id = s.source_item_id";

function isStatus(value: string | undefined): value is EditorialSignalStatus {
  return Boolean(value && statuses.has(value as EditorialSignalStatus));
}

function isRisk(value: string | undefined): value is EditorialSignalRiskLevel {
  return Boolean(value && risks.has(value as EditorialSignalRiskLevel));
}

function cleanSources(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
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

async function findSignal(id: string) {
  const result = await pool.query(`${selectSignal} where s.id = $1 limit 1`, [id]);
  return result.rows[0] ? toSignal(result.rows[0]) : null;
}

async function sourceExists(id: string): Promise<boolean> {
  const result = await pool.query("select id from source_items where id = $1 limit 1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function registerEditorialSignalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/editorial-signals", { preHandler: requireAdminToken }, async () => {
    const result = await pool.query(`${selectSignal} order by s.created_at desc limit 100`);
    return { count: result.rowCount, signals: result.rows.map(toSignal) };
  });

  app.get<{ Params: EditorialSignalParams }>("/editorial-signals/:id", { preHandler: requireAdminToken }, async (request, reply) => {
    const signal = await findSignal(request.params.id);
    if (!signal) return reply.code(404).send({ error: "not_found", message: "Editorial signal not found" });
    return { signal };
  });

  app.post<{ Params: SourceItemSignalParams; Body: CreateEditorialSignalBody }>("/source-items/:id/editorial-signals", { preHandler: requireAdminToken }, async (request, reply) => {
    const category = request.body?.category?.trim();
    const summaryInternal = request.body?.summaryInternal?.trim();
    const editorialAngle = request.body?.editorialAngle?.trim();
    const riskLevel = request.body?.riskLevel ?? "medium";
    const status = request.body?.status ?? "qualified";

    if (!category || !summaryInternal || !editorialAngle) return reply.code(400).send({ error: "invalid_signal", message: "Category, internal summary and editorial angle are required" });
    if (!isRisk(riskLevel)) return reply.code(400).send({ error: "invalid_risk_level", message: "Unsupported editorial signal risk level" });
    if (!isStatus(status)) return reply.code(400).send({ error: "invalid_status", message: "Unsupported editorial signal status" });
    if (!(await sourceExists(request.params.id))) return reply.code(404).send({ error: "not_found", message: "Source item not found" });

    const id = randomUUID();
    await pool.query("insert into editorial_signals (id, source_item_id, category, summary_internal, editorial_angle, risk_level, status, primary_sources, metadata, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, now(), now())", [id, request.params.id, category, summaryInternal, editorialAngle, riskLevel, status, JSON.stringify(cleanSources(request.body?.primarySources))]);
    return reply.code(201).send({ signal: await findSignal(id) });
  });

  app.post<{ Params: EditorialSignalParams; Body: UpdateEditorialSignalStatusBody }>("/editorial-signals/:id/status", { preHandler: requireAdminToken }, async (request, reply) => {
    if (!isStatus(request.body?.status)) return reply.code(400).send({ error: "invalid_status", message: "Unsupported editorial signal status" });
    const result = await pool.query("update editorial_signals set status = $2, updated_at = now() where id = $1 returning id", [request.params.id, request.body.status]);
    if (result.rowCount === 0) return reply.code(404).send({ error: "not_found", message: "Editorial signal not found" });
    return { signal: await findSignal(request.params.id) };
  });
}
