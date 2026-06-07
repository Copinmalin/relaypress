import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { adaptPublicationContent, type PublicationTarget } from "./content-adapter.js";
import { pool } from "./db.js";

type SignalParams = {
  id: string;
};

type SignalPublicationJobsBody = {
  platforms?: string[];
  status?: "pending_review" | "drafted";
};

const SUPPORTED_PLATFORMS = new Set(["x", "linkedin", "facebook", "instagram"]);

function parsePlatforms(platforms: string[] | undefined): PublicationTarget[] {
  const normalized = [...new Set((platforms ?? []).map((platform) => platform.trim().toLowerCase()))];
  return normalized.filter((platform): platform is PublicationTarget => SUPPORTED_PLATFORMS.has(platform));
}

function parseJobStatus(status: string | undefined): "pending_review" | "drafted" {
  return status === "drafted" ? "drafted" : "pending_review";
}

function rowToJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceItemId: row.source_item_id,
    editorialSignalId: row.editorial_signal_id,
    platform: row.platform,
    status: row.status,
    sourceContent: row.source_content,
    adaptedContent: row.adapted_content,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findReadySignal(id: string) {
  const result = await pool.query(
    `
      select
        s.id,
        s.source_item_id,
        s.category,
        s.summary_internal,
        s.editorial_angle,
        s.risk_level,
        s.status,
        s.primary_sources,
        i.title as source_title,
        i.canonical_url as source_canonical_url,
        i.provider as source_provider
      from editorial_signals s
      join source_items i on i.id = s.source_item_id
      where s.id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

function buildSourceContent(signal: Record<string, unknown>): string {
  const primarySources = Array.isArray(signal.primary_sources) ? signal.primary_sources : [];
  const sourcesText = primarySources.length > 0
    ? `\n\nPrimary sources:\n${primarySources.map((source) => `- ${String(source)}`).join("\n")}`
    : "";

  return [
    `Source: ${String(signal.source_title ?? "Untitled source")}`,
    `URL: ${String(signal.source_canonical_url ?? "")}`,
    `Category: ${String(signal.category)}`,
    `Risk: ${String(signal.risk_level)}`,
    "",
    `Internal summary: ${String(signal.summary_internal)}`,
    "",
    `Editorial angle: ${String(signal.editorial_angle)}`,
    sourcesText,
  ].join("\n").trim();
}

async function findJobs(ids: string[]) {
  if (ids.length === 0) return [];

  const result = await pool.query(
    `
      select
        id,
        source_item_id,
        editorial_signal_id,
        platform,
        status,
        source_content,
        adapted_content,
        error_message,
        created_at,
        updated_at
      from publication_jobs
      where id = any($1::varchar[])
      order by created_at asc
    `,
    [ids],
  );

  return result.rows.map(rowToJob);
}

async function createJobs(signal: Record<string, unknown>, platforms: PublicationTarget[], status: "pending_review" | "drafted") {
  const signalId = String(signal.id);
  const sourceItemId = String(signal.source_item_id);
  const sourceContent = buildSourceContent(signal);
  const jobIds = platforms.map((platform) => `signal:${signalId}:${platform}`);

  await pool.query("begin");

  try {
    for (const platform of platforms) {
      const adapted = adaptPublicationContent(sourceContent, platform);
      await pool.query(
        `
          insert into publication_jobs (
            id,
            source_event_id,
            source_item_id,
            editorial_signal_id,
            platform,
            status,
            source_content,
            adapted_content,
            error_message,
            created_at,
            updated_at
          ) values ($1, null, $2, $3, $4, $5, $6, $7, $8, now(), now())
          on conflict (id) do nothing
        `,
        [
          `signal:${signalId}:${platform}`,
          sourceItemId,
          signalId,
          platform,
          status,
          adapted.sourceContent,
          adapted.content,
          adapted.warnings.length > 0 ? adapted.warnings.join(",") : null,
        ],
      );
    }

    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  }

  return findJobs(jobIds);
}

export async function registerSignalPublicationJobRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: SignalParams; Body: SignalPublicationJobsBody }>(
    "/editorial-signals/:id/publication-jobs",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const platforms = parsePlatforms(request.body?.platforms);
      const status = parseJobStatus(request.body?.status);

      if (platforms.length === 0) {
        return reply.code(400).send({
          error: "invalid_platforms",
          message: "At least one supported platform is required",
        });
      }

      const signal = await findReadySignal(request.params.id);
      if (!signal) {
        return reply.code(404).send({ error: "not_found", message: "Editorial signal not found" });
      }

      if (signal.status !== "ready_for_campaign") {
        return reply.code(409).send({
          error: "signal_not_ready_for_campaign",
          message: "Only ready_for_campaign signals can be converted into publication jobs",
        });
      }

      const jobs = await createJobs(signal, platforms, status);

      return reply.code(201).send({ count: jobs.length, jobs });
    },
  );
}
