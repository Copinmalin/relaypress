import type { SupportedPlatform } from "./intents.js";

export type PublicationTarget = SupportedPlatform | "review";

export type AdaptedPublicationContent = {
  platform: PublicationTarget;
  sourceContent: string;
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

function splitParagraphs(content: string): string[] {
  return normalizeWhitespace(content)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function ensureSentenceEnding(content: string): string {
  if (!content) return content;
  return /[.!?…]$/.test(content) ? content : `${content}.`;
}

function titleCaseFirstLetter(content: string): string {
  if (!content) return content;
  return content.charAt(0).toUpperCase() + content.slice(1);
}

function buildLinkedInHook(firstParagraph: string): string {
  const clean = titleCaseFirstLetter(ensureSentenceEnding(firstParagraph.trim()));

  if (clean.length <= 130) {
    return clean;
  }

  const clipped = clean.slice(0, 127).replace(/\s+\S*$/, "").trim();
  return `${clipped}…`;
}

function adaptLinkedInContent(sourceContent: string): string {
  const paragraphs = splitParagraphs(sourceContent);

  if (paragraphs.length === 0) {
    return "";
  }

  const hook = buildLinkedInHook(paragraphs[0]);
  const body = paragraphs.length > 1 ? paragraphs.slice(1) : paragraphs;
  const bodyText = body
    .map((paragraph) => titleCaseFirstLetter(ensureSentenceEnding(paragraph)))
    .join("\n\n");

  const callToDiscussion = "Et vous, comment abordez-vous ce sujet ?";

  return normalizeWhitespace([
    hook,
    bodyText,
    callToDiscussion,
    "#Bitcoin #SouverainetéNumérique #RelayPress",
  ].filter(Boolean).join("\n\n"));
}

export function cleanSourceContent(content: string): string {
  return normalizeWhitespace(cleanPublishHashtags(removePublishCommand(content)));
}

export function adaptPublicationContent(
  sourceContent: string,
  platform: PublicationTarget,
): AdaptedPublicationContent {
  const cleanContent = cleanSourceContent(sourceContent);
  const warnings: string[] = [];
  const content = platform === "linkedin" ? adaptLinkedInContent(cleanContent) : cleanContent;

  if (!content) {
    warnings.push("empty_content_after_cleaning");
  }

  if (platform === "x" && content.length > 140) {
    warnings.push("x_content_over_140_chars");
  }

  if (platform === "linkedin" && content.length > cleanContent.length) {
    warnings.push("linkedin_content_structured_deterministically");
  }

  if (platform === "instagram") {
    warnings.push("instagram_requires_caption_or_media_strategy_later");
  }

  return {
    platform,
    sourceContent: cleanContent,
    content,
    warnings,
  };
}
