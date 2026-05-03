import type { Event } from "nostr-tools";

export type SupportedPlatform = "x" | "linkedin" | "facebook" | "instagram";

export type PublicationIntent = {
  shouldCreateJob: boolean;
  platforms: SupportedPlatform[];
  content: string;
  reason: string;
};

const SUPPORTED_PLATFORMS = new Set<SupportedPlatform>([
  "x",
  "linkedin",
  "facebook",
  "instagram",
]);

function normalizeToken(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/^@/, "")
    .replace(/[,.;:!?)]$/, "");
}

function extractPublishCommandPlatforms(content: string): SupportedPlatform[] {
  const match = content.match(/^\s*\/publish\s+([^\n\r]+)/im);
  if (!match) return [];

  return match[1]
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token): token is SupportedPlatform => SUPPORTED_PLATFORMS.has(token as SupportedPlatform));
}

function extractHashtagPlatforms(content: string): SupportedPlatform[] {
  const tokens = content
    .split(/\s+/)
    .map(normalizeToken);

  return tokens.filter((token): token is SupportedPlatform => SUPPORTED_PLATFORMS.has(token as SupportedPlatform));
}

function hasPublishIntent(content: string): boolean {
  const lowerContent = content.toLowerCase();

  return (
    /^\s*\/publish\b/im.test(content) ||
    lowerContent.includes("#publish") ||
    lowerContent.includes("#relaypress")
  );
}

function dedupePlatforms(platforms: SupportedPlatform[]): SupportedPlatform[] {
  return Array.from(new Set(platforms));
}

export function parsePublicationIntent(event: Event): PublicationIntent {
  if (event.kind !== 1) {
    return {
      shouldCreateJob: false,
      platforms: [],
      content: event.content,
      reason: "unsupported_kind",
    };
  }

  if (!hasPublishIntent(event.content)) {
    return {
      shouldCreateJob: false,
      platforms: [],
      content: event.content,
      reason: "no_publish_intent",
    };
  }

  const platforms = dedupePlatforms([
    ...extractPublishCommandPlatforms(event.content),
    ...extractHashtagPlatforms(event.content),
  ]);

  return {
    shouldCreateJob: true,
    platforms,
    content: event.content,
    reason: platforms.length > 0 ? "publish_intent" : "publish_intent_without_platform",
  };
}
