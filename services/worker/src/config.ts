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

export const workerConfig = {
  tickIntervalMs: Number(process.env.WORKER_TICK_INTERVAL_MS ?? 30_000),
  publisherMode: process.env.PUBLISHER_MODE ?? "mock",
  publisherBatchSize: Number(process.env.PUBLISHER_BATCH_SIZE ?? 10),
  sourceIngestionEnabled: readBooleanEnv("SOURCE_INGESTION_ENABLED", true),
  sourceIngestionBatchSize: Number(process.env.SOURCE_INGESTION_BATCH_SIZE ?? 10),
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
