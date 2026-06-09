import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { adaptPublicationContent, type PublicationTarget } from "./content-adapter.js";
import { pool } from "./db.js";

type JobParams = {
  id: string;
};

type GenerateBody = {
  instruction?: string;
  mode?: "mock" | "openai";
};

type JobRow = {
  id: string;
  platform: PublicationTarget;
  status: string;
  source_content: string | null;
  adapted_content: string | null;
  external_post_id: string | null;
  published_at: Date | string | null;
};

const EDITABLE_STATUSES = new Set(["pending_review", "drafted"]);

function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function parseMode(value: string | undefined): "mock" | "openai" {
  if (!hasOpenAiKey()) return "mock";
  if (value === "openai") return "openai";
  if (process.env.AI_PROVIDER === "openai") return "openai";
  return "mock";
}

function buildMockGeneration(sourceContent: string, platform: PublicationTarget, instruction: string | undefined) {
  const header = instruction?.trim()
    ? `Instruction editoriale: ${instruction.trim()}\n\n`
    : "";

  return adaptPublicationContent(`${header}${sourceContent}`, platform);
}

async function generateWithOpenAi(sourceContent: string, platform: PublicationTarget, instruction: string | undefined) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    "Tu es RelayPress. Reecris le contenu source pour la plateforme demandee.",
    "Contraintes absolues: ne publie rien, ne pretend pas avoir publie, garde une tonalite professionnelle, respecte la source.",
    `Plateforme: ${platform}`,
    instruction?.trim() ? `Instruction editoriale: ${instruction.trim()}` : "Instruction editoriale: aucune",
    "",
    "Contenu source:",
    sourceContent,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.5",
      input: prompt,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`OpenAI generation failed: ${response.status} ${details.slice(0, 200)}`);
  }

  const payload = await response.json() as { output_text?: string };
  const generated = payload.output_text?.trim();
  if (!generated) throw new Error("OpenAI generation returned empty output");

  return adaptPublicationContent(generated, platform);
}

function rowToJob(row: Record<string, unknown>) {
  return {
    id: row.id,
    sourceEventId: row.source_event_id,
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

async function findJob(id: string): Promise<JobRow | null> {
  const result = await pool.query<JobRow>(
    `
      select
        id,
        platform,
        status,
        source_content,
        adapted_content,
        external_post_id,
        published_at
      from publication_jobs
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function updateGeneratedContent(id: string, content: string, errorMessage: string | null) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        adapted_content = $2,
        error_message = $3,
        updated_at = now()
      where id = $1
        and status in ('pending_review', 'drafted')
        and external_post_id is null
        and published_at is null
      returning
        id,
        source_event_id,
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
    `,
    [id, content, errorMessage],
  );

  return result.rows[0] ? rowToJob(result.rows[0]) : null;
}

export async function registerAiGenerationRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: JobParams; Body: GenerateBody }>(
    "/publication-jobs/:id/generate",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const job = await findJob(request.params.id);

      if (!job) {
        return reply.code(404).send({ error: "not_found", message: "Publication job not found" });
      }

      if (!EDITABLE_STATUSES.has(job.status)) {
        return reply.code(409).send({
          error: "job_not_generatable",
          message: "Only pending_review or drafted unpublished jobs can be generated",
        });
      }

      if (job.external_post_id || job.published_at) {
        return reply.code(409).send({
          error: "job_already_published",
          message: "Already published jobs cannot be generated",
        });
      }

      const sourceContent = String(job.source_content ?? job.adapted_content ?? "").trim();
      if (!sourceContent) {
        return reply.code(400).send({ error: "empty_source_content", message: "source_content is required" });
      }

      const mode = parseMode(request.body?.mode);
      const adapted = mode === "openai"
        ? await generateWithOpenAi(sourceContent, job.platform, request.body?.instruction) ?? buildMockGeneration(sourceContent, job.platform, request.body?.instruction)
        : buildMockGeneration(sourceContent, job.platform, request.body?.instruction);

      const warnings = [...adapted.warnings, mode === "mock" ? "ai_generation_mock_mode" : "ai_generation_openai_mode"];
      const updatedJob = await updateGeneratedContent(request.params.id, adapted.content, warnings.length ? warnings.join(",") : null);

      if (!updatedJob) {
        return reply.code(409).send({
          error: "job_not_updated",
          message: "Job could not be updated without changing approval or publication status",
        });
      }

      return {
        mode,
        job: updatedJob,
      };
    },
  );
}
