import type { PlatformPublisherMode, PublisherPlatform } from "./publisher/types.js";

export function readCsvEnv(name: string, fallback: string[] = []): string[] {
  const value = process.env[name];
  if (!value) return fallback;

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readBooleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (!value) return fallback;

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function readPlatformPublisherMode(
  name: string,
  fallback: PlatformPublisherMode,
): PlatformPublisherMode {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "disabled" || value === "mock" || value === "real") return value;

  console.warn(JSON.stringify({
    service: "relaypress-worker",
    component: "publisher-config",
    status: "invalid_config_fallback",
    variable: name,
    receivedValue: value,
    fallback,
    allowedValues: ["disabled", "mock", "real"],
    timestamp: new Date().toISOString(),
  }));

  return fallback;
}

const legacyPublisherMode = process.env.PUBLISHER_MODE?.trim() || "mock";

function legacyFallback(platform: PublisherPlatform): PlatformPublisherMode {
  if (legacyPublisherMode === "linkedin_real") {
    return platform === "linkedin" ? "real" : "disabled";
  }

  if (platform === "instagram") return "disabled";
  return "mock";
}

export const workerConfig = {
  tickIntervalMs: Number(process.env.WORKER_TICK_INTERVAL_MS ?? 30_000),
  publisherBatchSize: Number(process.env.PUBLISHER_BATCH_SIZE ?? 10),
  legacyPublisherMode,
  publisherModes: {
    linkedin: readPlatformPublisherMode("LINKEDIN_PUBLISHER_MODE", legacyFallback("linkedin")),
    x: readPlatformPublisherMode("X_PUBLISHER_MODE", legacyFallback("x")),
    facebook: readPlatformPublisherMode("FACEBOOK_PUBLISHER_MODE", legacyFallback("facebook")),
    instagram: readPlatformPublisherMode("INSTAGRAM_PUBLISHER_MODE", legacyFallback("instagram")),
    nostr_longform: readPlatformPublisherMode("NOSTR_PUBLISHER_MODE", legacyFallback("nostr_longform")),
  } satisfies Record<PublisherPlatform, PlatformPublisherMode>,
  publisherSafetyAcks: {
    linkedin: process.env.LINKEDIN_REAL_SAFETY_ACK ?? "",
    x: process.env.X_REAL_SAFETY_ACK ?? "",
    facebook: process.env.META_REAL_SAFETY_ACK ?? "",
    instagram: process.env.META_REAL_SAFETY_ACK ?? "",
    nostr_longform: process.env.NOSTR_REAL_SAFETY_ACK ?? "",
  } satisfies Record<PublisherPlatform, string>,
  sourceIngestionEnabled: readBooleanEnv("SOURCE_INGESTION_ENABLED", true),
  sourceIngestionBatchSize: Number(process.env.SOURCE_INGESTION_BATCH_SIZE ?? 10),
  sourceIngestionIntervalMs: Number(process.env.SOURCE_INGESTION_INTERVAL_MS ?? 43_200_000),
  btcbreakdownBaseUrl: normalizeBaseUrl(process.env.BTCBREAKDOWN_BASE_URL ?? "https://www.btcbreakdown.com"),
  linkedinAccessToken: process.env.LINKEDIN_ACCESS_TOKEN ?? "",
  linkedinAuthorUrn: process.env.LINKEDIN_AUTHOR_URN ?? "",
  linkedinApiBaseUrl: normalizeBaseUrl(process.env.LINKEDIN_API_BASE_URL ?? "https://api.linkedin.com/v2"),
  nostrPrivateRelay: process.env.NOSTR_PRIVATE_RELAY ?? "ws://strfry:7777",
  nostrPublicRelays: readCsvEnv("NOSTR_PUBLIC_RELAYS", [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
  ]),
  nostrAllowedPubkeys: readCsvEnv("NOSTR_ALLOWED_PUBKEYS"),
  nostrIndexAll: readBooleanEnv("NOSTR_INDEX_ALL", false),
  nostrLookbackSeconds: Number(process.env.NOSTR_LOOKBACK_SECONDS ?? 3600),
};
