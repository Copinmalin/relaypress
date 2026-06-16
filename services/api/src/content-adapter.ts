export type PublicationTarget = "x" | "linkedin" | "facebook" | "instagram" | "nostr_longform" | "review";

export type AdaptedPublicationContent = {
  platform: PublicationTarget;
  sourceContent: string;
  content: string;
  warnings: string[];
};

export type AdaptPublicationOptions = {
  preserveGeneratedStructure?: boolean;
};

const X_MAX_CHARACTERS = 140;

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
  const body = paragraphs.length > 1 ? paragraphs.slice(1) : [];
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

function clipAtWordBoundary(content: string, maximumLength: number): string {
  if (content.length <= maximumLength) return content;
  if (maximumLength <= 1) return content.slice(0, Math.max(maximumLength, 0));

  const clipped = content
    .slice(0, maximumLength - 1)
    .replace(/\s+\S*$/, "")
    .trim();

  const base = clipped || content.slice(0, maximumLength - 1).trim();
  return `${base}…`.slice(0, maximumLength);
}

function fitXContent(content: string): { content: string; truncated: boolean } {
  const normalized = normalizeWhitespace(content).replace(/\s+/g, " ");
  if (normalized.length <= X_MAX_CHARACTERS) {
    return { content: normalized, truncated: false };
  }

  const urls = [...normalized.matchAll(/https?:\/\/[^\s)\]]+/gi)];
  const sourceUrl = urls.at(-1)?.[0] ?? null;

  if (!sourceUrl) {
    return {
      content: clipAtWordBoundary(normalized, X_MAX_CHARACTERS),
      truncated: true,
    };
  }

  if (sourceUrl.length >= X_MAX_CHARACTERS) {
    return {
      content: sourceUrl.slice(0, X_MAX_CHARACTERS),
      truncated: true,
    };
  }

  const body = normalizeWhitespace(normalized.replace(sourceUrl, "")).replace(/\s+/g, " ");
  const bodyMaximum = X_MAX_CHARACTERS - sourceUrl.length - 1;
  const fittedBody = clipAtWordBoundary(body, bodyMaximum);
  const fitted = fittedBody ? `${fittedBody} ${sourceUrl}` : sourceUrl;

  return {
    content: fitted.slice(0, X_MAX_CHARACTERS),
    truncated: true,
  };
}

export function cleanSourceContent(content: string): string {
  return normalizeWhitespace(cleanPublishHashtags(removePublishCommand(content)));
}

function addPlatformWarnings(platform: PublicationTarget, content: string, warnings: string[]): void {
  if (!content) return;

  if (platform === "x" && content.length > X_MAX_CHARACTERS) {
    warnings.push("x_content_over_140_chars");
  }

  if (platform === "linkedin") {
    if (content.length < 1300) warnings.push("linkedin_content_under_1300_chars");
    if (content.length > 2000) warnings.push("linkedin_content_over_2000_chars");
  }

  if (platform === "facebook") {
    if (content.length < 900) warnings.push("facebook_content_under_900_chars");
    if (content.length > 1500) warnings.push("facebook_content_over_1500_chars");
  }

  if (platform === "nostr_longform" && content.length <= 1500) {
    warnings.push("nostr_longform_content_not_over_1500_chars");
  }
}

export function adaptPublicationContent(
  sourceContent: string,
  platform: PublicationTarget,
  options: AdaptPublicationOptions = {},
): AdaptedPublicationContent {
  const cleanContent = cleanSourceContent(sourceContent);
  const warnings: string[] = [];
  const shouldApplyDeterministicStructure = platform === "linkedin" && !options.preserveGeneratedStructure;
  let content = shouldApplyDeterministicStructure ? adaptLinkedInContent(cleanContent) : cleanContent;

  if (platform === "x") {
    const fitted = fitXContent(content);
    content = fitted.content;
    if (fitted.truncated) warnings.push("x_content_truncated_to_140_chars");
  }

  if (!content) {
    warnings.push("empty_content_after_cleaning");
  }

  addPlatformWarnings(platform, content, warnings);

  if (shouldApplyDeterministicStructure && content.length > cleanContent.length) {
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
