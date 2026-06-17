import type { PublisherPlatform } from "./publisher/types.js";

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

export type PublisherEffectiveMode = "mock" | "disabled";

export type PublisherRouteConfig = {
  platform: PublisherPlatform;
  envName: string;
  requestedMode: string;
  effectiveMode: PublisherEffectiveMode;
  reason?: string;
  safetyAckConfigured: boolean;
};

function readPublisherRoute(
  platform: PublisherPlatform,
  envName: string,
  fallback: PublisherEffectiveMode,
  safetyAckEnvName: string,
): PublisherRouteConfig {
  const requestedMode = (process.env[envName] ?? fallback).trim().toLowerCase();

  if (requestedMode === "mock") {
    return {
      platform,
      envName,
      requestedMode,
      effectiveMode: "mock",
      safetyAckConfigured: Boolean(process.env[safetyAckEnvName]?.trim()),
    };
  }

  if (requestedMode === "disabled") {
    return {
      platform,
      envName,
      requestedMode,
      effectiveMode: "disabled",
      reason: "publisher_disabled_by_configuration",
      safetyAckConfigured: Boolean(process.env[safetyAckEnvName]?.trim()),
    };
  }

  if (requestedMode === "real") {
    return {
      platform,
      envName,
      requestedMode,
      effectiveMode: "disabled",
      reason: "real_publisher_not_enabled_in_pr_x0",
      safetyAckConfigured: Boolean(process.env[safetyAckEnvName]?.trim()),
    };
  }

  return {
    platform,
    envName,
    requestedMode,
    effectiveMode: "disabled",
    reason: "unsupported_publisher_mode",
    safetyAckConfigured: Boolean(process.env[safetyAckEnvName]?.trim()),
  };
}

export const workerConfig = {
  tickIntervalMs: Number(process.env.WORKER_TICK_INTERVAL_MS ?? 30_000),
  publisherBatchSize: Number(process.env.PUBLISHER_BATCH_SIZE ?? 10),
  legacyPublisherMode: process.env.PUBLISHER_MODE ?? "",
  publisherRoutes: {
    linkedin: readPublisherRoute(
      "linkedin",
      "LINKEDIN_PUBLISHER_MODE",
      "mock",
      "LINKEDIN_REAL_SAFETY_ACK",
    ),
    x: readPublisherRoute(
      "x",
      "X_PUBLISHER_MODE",
      "mock",
      "X_REAL_SAFETY_ACK",
    ),
    facebook: readPublisherRoute(
      "facebook",
      "FACEBOOK_PUBLISHER_MODE",
      "mock",
      "META_REAL_SAFETY_ACK",
    ),
    instagram: readPublisherRoute(
      "instagram",
      "INSTAGRAM_PUBLISHER_MODE",
      "disabled",
      "META_REAL_SAFETY_ACK",
    ),
    nostr_longform: readPublisherRoute(
      "nostr_longform",
      "NOSTR_PUBLISHER_MODE",
      "mock",
      "NOSTR_REAL_SAFETY_ACK",
    ),
  } satisfies Record<PublisherPlatform, PublisherRouteConfig>,
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
