export type StructuredGenerationOutput = {
  finalText: string;
  factsUsed: string[];
  claimsRequiringHumanReview: string[];
  sourceUrl: string | null;
  format: string | null;
  tone: string | null;
  warnings: string[];
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function extractFirstUrl(value: string): string | null {
  return /(https?:\/\/[^\s)\]]+)/i.exec(value)?.[1] ?? null;
}

export function parseStructuredGenerationOutput(raw: string): StructuredGenerationOutput | null {
  try {
    const parsed = JSON.parse(extractJsonCandidate(raw)) as Record<string, unknown>;
    const finalText = asString(parsed.final_text ?? parsed.finalText);
    if (!finalText) return null;

    return {
      finalText,
      factsUsed: asStringArray(parsed.facts_used ?? parsed.factsUsed),
      claimsRequiringHumanReview: asStringArray(
        parsed.claims_requiring_human_review ?? parsed.claimsRequiringHumanReview,
      ),
      sourceUrl: asString(parsed.source_url ?? parsed.sourceUrl),
      format: asString(parsed.format),
      tone: asString(parsed.tone),
      warnings: asStringArray(parsed.warnings),
    };
  } catch {
    return null;
  }
}

export function buildFallbackGenerationOutput(raw: string, sourceContent: string): StructuredGenerationOutput {
  return {
    finalText: raw.trim(),
    factsUsed: [],
    claimsRequiringHumanReview: [],
    sourceUrl: extractFirstUrl(sourceContent),
    format: null,
    tone: null,
    warnings: ["ai_generation_json_parse_failed"],
  };
}
