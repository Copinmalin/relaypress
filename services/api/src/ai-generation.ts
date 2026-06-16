import type { FastifyInstance } from "fastify";
import { requireAdminToken } from "./auth.js";
import { adaptPublicationContent, type AdaptedPublicationContent, type PublicationTarget } from "./content-adapter.js";
import { pool } from "./db.js";
import {
  buildFallbackGenerationOutput,
  extractFirstUrl,
  parseStructuredGenerationOutput,
  type StructuredGenerationOutput,
} from "./generation-output.js";
import { buildGenerationPrompt, type GenerationStyleProfile } from "./generation-prompts.js";

type JobParams = {
  id: string;
};

export type GenerateBody = {
  instruction?: string;
  mode?: "mock" | "openai";
  styleProfile?: GenerationStyleProfile;
  outputFormat?: string;
};

export type GenerationMode = "mock" | "openai";
type OpenAiTextVerbosity = "low" | "medium" | "high";
type OpenAiReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

type JobRow = {
  id: string;
  platform: PublicationTarget;
  status: string;
  source_content: string | null;
  adapted_content: string | null;
  external_post_id: string | null;
  published_at: Date | string | null;
};

export type GenerationMetadata = {
  mode: GenerationMode;
  model: string | null;
  warnings: string[];
  factsUsed: string[];
  claimsRequiringHumanReview: string[];
  sourceUrl: string | null;
  format: string | null;
  tone: string | null;
  textVerbosity?: OpenAiTextVerbosity;
  reasoningEffort?: OpenAiReasoningEffort;
  maxOutputTokens?: number;
};

type GeneratedContent = {
  adapted: AdaptedPublicationContent;
  generation: GenerationMetadata;
};

export type GenerationResponse = {
  mode: GenerationMode;
  model: string | null;
  warnings: string[];
  generation: GenerationMetadata;
  job: Record<string, unknown>;
};

export type GenerationOperationResult =
  | { ok: true; value: GenerationResponse }
  | { ok: false; statusCode: number; error: string; message: string };

type OpenAiResponsePayload = {
  id?: string;
  status?: string;
  output_text?: string;
  error?: {
    message?: string;
  };
  incomplete_details?: unknown;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const EDITABLE_STATUSES = new Set(["pending_review", "drafted"]);
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_TEXT_VERBOSITY: OpenAiTextVerbosity = "high";
const DEFAULT_OPENAI_REASONING_EFFORT: OpenAiReasoningEffort = "medium";
const DEFAULT_OPENAI_MAX_OUTPUT_TOKENS = 2500;
const TEXT_VERBOSITY_VALUES = new Set<OpenAiTextVerbosity>(["low", "medium", "high"]);
const REASONING_EFFORT_VALUES = new Set<OpenAiReasoningEffort>(["none", "minimal", "low", "medium", "high", "xhigh"]);

const GENERATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    final_text: {
      type: "string",
      description: "Publication finale prete pour relecture humaine.",
    },
    facts_used: {
      type: "array",
      description: "Faits explicitement utilises depuis la source fournie.",
      items: { type: "string" },
    },
    claims_requiring_human_review: {
      type: "array",
      description: "Affirmations utiles mais a verifier manuellement avant publication.",
      items: { type: "string" },
    },
    source_url: {
      type: ["string", "null"],
      description: "URL source explicite si elle est fournie.",
    },
    format: {
      type: "string",
      description: "Format editorial utilise.",
    },
    tone: {
      type: "string",
      description: "Tonalite appliquee.",
    },
    warnings: {
      type: "array",
      description: "Alertes de generation, hors warnings metier de plateforme.",
      items: { type: "string" },
    },
  },
  required: [
    "final_text",
    "facts_used",
    "claims_requiring_human_review",
    "source_url",
    "format",
    "tone",
    "warnings",
  ],
};

function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function parseMode(value: string | undefined): GenerationMode {
  if (!hasOpenAiKey()) return "mock";
  if (value === "openai") return "openai";
  if (process.env.AI_PROVIDER === "openai") return "openai";
  return "mock";
}

function selectedOpenAiModel(): string {
  return process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
}

function selectedTextVerbosity(): OpenAiTextVerbosity {
  const value = process.env.OPENAI_TEXT_VERBOSITY as OpenAiTextVerbosity | undefined;
  return value && TEXT_VERBOSITY_VALUES.has(value) ? value : DEFAULT_OPENAI_TEXT_VERBOSITY;
}

function selectedReasoningEffort(): OpenAiReasoningEffort {
  const value = process.env.OPENAI_REASONING_EFFORT as OpenAiReasoningEffort | undefined;
  return value && REASONING_EFFORT_VALUES.has(value) ? value : DEFAULT_OPENAI_REASONING_EFFORT;
}

function selectedMaxOutputTokens(): number {
  const value = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? DEFAULT_OPENAI_MAX_OUTPUT_TOKENS);
  if (!Number.isFinite(value)) return DEFAULT_OPENAI_MAX_OUTPUT_TOKENS;
  return Math.min(Math.max(Math.round(value), 512), 8000);
}

function buildGenerationMetadata(
  mode: GenerationMode,
  model: string | null,
  sourceContent: string,
  output: StructuredGenerationOutput | null,
  extraWarnings: string[] = [],
  controls?: { textVerbosity?: OpenAiTextVerbosity; reasoningEffort?: OpenAiReasoningEffort; maxOutputTokens?: number },
): GenerationMetadata {
  return {
    mode,
    model,
    warnings: [...(output?.warnings ?? []), ...extraWarnings],
    factsUsed: output?.factsUsed ?? [],
    claimsRequiringHumanReview: output?.claimsRequiringHumanReview ?? [],
    sourceUrl: output?.sourceUrl ?? extractFirstUrl(sourceContent),
    format: output?.format ?? null,
    tone: output?.tone ?? null,
    ...controls,
  };
}

function buildMockGeneration(
  sourceContent: string,
  platform: PublicationTarget,
  instruction: string | undefined,
): GeneratedContent {
  const header = instruction?.trim()
    ? `Instruction editoriale: ${instruction.trim()}\n\n`
    : "";
  const adapted = adaptPublicationContent(`${header}${sourceContent}`, platform);

  return {
    adapted,
    generation: buildGenerationMetadata("mock", null, sourceContent, null),
  };
}

function extractOpenAiText(payload: OpenAiResponsePayload): string {
  const direct = payload.output_text?.trim();
  if (direct) return direct;

  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" || content.type === "text")
    .map((content) => content.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .trim() ?? "";
}

async function generateWithOpenAi(
  sourceContent: string,
  platform: PublicationTarget,
  body: GenerateBody | undefined,
): Promise<GeneratedContent | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = selectedOpenAiModel();
  const textVerbosity = selectedTextVerbosity();
  const reasoningEffort = selectedReasoningEffort();
  const maxOutputTokens = selectedMaxOutputTokens();
  const prompt = buildGenerationPrompt({
    platform,
    sourceContent,
    instruction: body?.instruction,
    styleProfile: body?.styleProfile,
    outputFormat: body?.outputFormat,
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: prompt.instructions,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt.inputText,
            },
          ],
        },
      ],
      reasoning: {
        effort: reasoningEffort,
      },
      max_output_tokens: maxOutputTokens,
      text: {
        verbosity: textVerbosity,
        format: {
          type: "json_schema",
          name: "relaypress_generation",
          strict: true,
          schema: GENERATION_JSON_SCHEMA,
        },
      },
      store: false,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`OpenAI generation failed: ${response.status} ${details.slice(0, 200)}`);
  }

  const payload = await response.json() as OpenAiResponsePayload;
  if (payload.error?.message) {
    throw new Error(`OpenAI generation failed: ${payload.error.message}`);
  }

  const generated = extractOpenAiText(payload);
  if (!generated) {
    throw new Error(
      `OpenAI generation returned empty output: status=${payload.status ?? "unknown"} id=${payload.id ?? "unknown"}`,
    );
  }

  const parsed = parseStructuredGenerationOutput(generated) ?? buildFallbackGenerationOutput(generated, sourceContent);
  const adapted = adaptPublicationContent(parsed.finalText, platform, { preserveGeneratedStructure: true });

  return {
    adapted,
    generation: buildGenerationMetadata("openai", model, sourceContent, parsed, [], {
      textVerbosity,
      reasoningEffort,
      maxOutputTokens,
    }),
  };
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
    generationMode: row.generation_mode,
    generationModel: row.generation_model,
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

async function updateGeneratedContent(
  id: string,
  content: string,
  errorMessage: string | null,
  generationMode: GenerationMode,
  generationModel: string | null,
) {
  const result = await pool.query(
    `
      update publication_jobs
      set
        adapted_content = $2,
        error_message = $3,
        generation_mode = $4,
        generation_model = $5,
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
        generation_mode,
        generation_model,
        scheduled_at,
        published_at,
        created_at,
        updated_at
    `,
    [id, content, errorMessage, generationMode, generationModel],
  );

  return result.rows[0] ? rowToJob(result.rows[0]) : null;
}

export async function generatePublicationJob(
  id: string,
  body: GenerateBody = {},
): Promise<GenerationOperationResult> {
  const job = await findJob(id);

  if (!job) {
    return { ok: false, statusCode: 404, error: "not_found", message: "Publication job not found" };
  }

  if (!EDITABLE_STATUSES.has(job.status)) {
    return {
      ok: false,
      statusCode: 409,
      error: "job_not_generatable",
      message: "Only pending_review or drafted unpublished jobs can be generated",
    };
  }

  if (job.external_post_id || job.published_at) {
    return {
      ok: false,
      statusCode: 409,
      error: "job_already_published",
      message: "Already published jobs cannot be generated",
    };
  }

  const sourceContent = String(job.source_content ?? job.adapted_content ?? "").trim();
  if (!sourceContent) {
    return {
      ok: false,
      statusCode: 400,
      error: "empty_source_content",
      message: "source_content is required",
    };
  }

  const mode = parseMode(body.mode);
  const generated = mode === "openai"
    ? await generateWithOpenAi(sourceContent, job.platform, body)
      ?? buildMockGeneration(sourceContent, job.platform, body.instruction)
    : buildMockGeneration(sourceContent, job.platform, body.instruction);

  const updatedJob = await updateGeneratedContent(
    id,
    generated.adapted.content,
    generated.adapted.warnings.length ? generated.adapted.warnings.join(",") : null,
    generated.generation.mode,
    generated.generation.model,
  );

  if (!updatedJob) {
    return {
      ok: false,
      statusCode: 409,
      error: "job_not_updated",
      message: "Job could not be updated without changing approval or publication status",
    };
  }

  return {
    ok: true,
    value: {
      mode: generated.generation.mode,
      model: generated.generation.model,
      warnings: generated.adapted.warnings,
      generation: generated.generation,
      job: updatedJob,
    },
  };
}

export async function registerAiGenerationRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: JobParams; Body: GenerateBody }>(
    "/publication-jobs/:id/generate",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const result = await generatePublicationJob(request.params.id, request.body ?? {});

      if (!result.ok) {
        return reply.code(result.statusCode).send({
          error: result.error,
          message: result.message,
        });
      }

      return result.value;
    },
  );
}
