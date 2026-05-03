import type { SupportedPlatform } from "./intents.js";

export type PublicationTarget = SupportedPlatform | "review";

export type AdaptedPublicationContent = {
  platform: PublicationTarget;
  content: string;
  warnings: string[];
};

function removePublishCommand(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/publish\b/i.test(line))
    .join("\n");
}

function cleanPublishHashtags(content: string): string {
  return content
    .replace(/(^|\s)#publish\b/gi, " ")
    .replace(/(^|\s)#relaypress\b/gi, " ");
}

function normalizeWhitespace(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanSourceContent(content: string): string {
  return normalizeWhitespace(cleanPublishHashtags(removePublishCommand(content)));
}

export function adaptPublicationContent(
  sourceContent: string,
  platform: PublicationTarget,
): AdaptedPublicationContent {
  const content = cleanSourceContent(sourceContent);
  const warnings: string[] = [];

  if (!content) {
    warnings.push("empty_content_after_cleaning");
  }

  if (platform === "x" && content.length > 140) {
    warnings.push("x_content_over_140_chars");
  }

  if (platform === "instagram") {
    warnings.push("instagram_requires_caption_or_media_strategy_later");
  }

  return {
    platform,
    content,
    warnings,
  };
}
