import type { PublisherPlatform } from "./publisher/types.js";

export const LINKEDIN_REAL_SAFETY_ACK_VALUE = "I_UNDERSTAND_LINKEDIN_REAL_PUBLICATION";

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

export type PublisherEffectiveMode = "mock" | "disabled" | "real";

export type PublisherRouteConfig = {
  platform: PublisherPlatform;
  envName: string;
  requestedMode: string;
  effectiveMode: PublisherEffectiveMode;
  reason?: string;
  safetyAckConfigured: boolean;
  safetyAckValid: boolean;
  accountConfigured: boolean;
  allowedJobIdConfigured: boolean;
  allowedJobId?: string;
};

function readPublisherRoute(
  platform: PublisherPlatform,
  envName: string,
  fallback: "mock" | "disabled",
  safetyAckEnvName: string,
): PublisherRouteConfig {
  const requestedMode = (process.env[envName] ?? fallback).trim().toLowerCase();
  const safetyAck = process.env[safetyAckEnvName]?.trim() ?? "";
  const safetyAckConfigured = safetyAck.length > 0;
  const safetyAckValid = platform === "linkedin" && safetyAck === LINKEDIN_REAL_SAFETY_ACK_VALUE;
  const accountId = process.env.LINKEDIN_PUBLISHER_ACCOUNT_ID?.trim() ?? "";
  const allowedJobId = process.env.LINKEDIN_REAL_ALLOWED_JOB_ID?.trim() ?? "";
  const accountConfigured = platform === "linkedin" && accountId.length > 0;
  const allowedJobIdConfigured = platform === "linkedin" && allowedJobId.length > 0;

  if (requestedMode === "mock") {
    return {
      platform,
      envName,
      requestedMode,
      effectiveMode: "mock",
      safetyAckConfigured,
      safetyAckValid,
      accountConfigured,
      allowedJobIdConfigured,
    };
  }

  if (requestedMode === "disabled") {
    return {
      platform,
      envName,
      requestedMode,
      effectiveMode: "disabled",
      reason: "publisher_disabled_by_configuration",
      safetyAckConfigured,
      safetyAckValid,
      accountConfigured,
      allowedJobIdConfigured,
    };
  }

  if (requestedMode === "real") {
    if (platform !== "linkedin") {
      return {
        platform,
        envName,
        requestedMode,
        effectiveMode: "disabled",
        reason: "real_publisher_not_enabled_for_platform",
        safetyAckConfigured,
        safetyAckValid,
        accountConfigured,
        allowedJobIdConfigured,
      };
    }

    if (!safetyAckValid) {
      return {
        platform,
        envName,
        requestedMode,
        effectiveMode: "disabled",
        reason: "linkedin_real_safety_ack_missing_or_invalid",
        safetyAckConfigured,
        safetyAckValid,
        accountConfigured,
        allowedJobIdConfigured,
      };
    }

    if (!accountConfigured) {
      return {
        platform,
        envName,
        requestedMode,
        effectiveMode: "disabled",
        reason: "linkedin_publisher_account_id_missing",
        safetyAckConfigured,
        safetyAckValid,
        accountConfigured,
        allowedJobIdConfigured,
      };
    }

    if (!allowedJobIdConfigured) {
      return {
        platform,
        envName,
        requestedMode,
        effectiveMode: "disabled",
        reason: "linkedin_real_allowed_job_id_missing",
        safetyAckConfigured,
        safetyAckValid,
        accountConfigured,
        allowedJobIdConfigured,
      };
    }

    return {
      platform,
      envName,
      requestedMode,
      effectiveMode: "real",
      safetyAckConfigured,
      safetyAckValid,
      accountConfigured,
      allowedJobIdConfigured,
      allowedJobId,
    };
  }

  return {
    platform,
    envName,
    requestedMode,
    effectiveMode: "disabled",
    reason: "unsupported_publisher_mode",
    safetyAckConfigured,
    safetyAckValid,
    accountConfigured,
    allowedJobIdConfigured,
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
  linkedinPublisherAccountId: process.env.LINKEDIN_PUBLISHER_ACCOUNT_ID?.trim() ?? "",
  linkedinApiBaseUrl: normalizeBaseUrl(process.env.LINKEDIN_API_BASE_URL ?? "https://api.linkedin.com/rest"),
  linkedinApiVersion: process.env.LINKEDIN_API_VERSION?.trim() || "202606",
  linkedinUserInfoUrl: process.env.LINKEDIN_USERINFO_URL?.trim() || "https://api.linkedin.com/v2/userinfo",
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
