import { workerConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { startNostrIndexer } from "./nostr/indexer.js";
import { describePublisherRouting, processApprovedPublicationJobs } from "./publisher/index.js";
import { ingestBtcBreakdownSourceItems } from "./sources/btcbreakdown.js";

const appName = "relaypress";
let lastSourceIngestionAt = 0;

async function ingestSources(): Promise<number> {
  if (!workerConfig.sourceIngestionEnabled) {
    return 0;
  }

  const now = Date.now();
  if (now - lastSourceIngestionAt < workerConfig.sourceIngestionIntervalMs) {
    return 0;
  }

  lastSourceIngestionAt = now;

  try {
    return await ingestBtcBreakdownSourceItems();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(JSON.stringify({
      service: "relaypress-worker",
      component: "source-ingestion",
      status: "failed",
      error: message,
      timestamp: new Date().toISOString(),
    }));

    return 0;
  }
}

async function tick() {
  const ingestedSourceItems = await ingestSources();
  const publishedJobs = await processApprovedPublicationJobs();

  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: appName,
    status: "running",
    publisherRouting: describePublisherRouting(),
    legacyPublisherMode: workerConfig.legacyPublisherMode || null,
    ingestedSourceItems,
    publishedJobs,
    timestamp: new Date().toISOString(),
  }));
}

await initializeDatabase();
await startNostrIndexer();
await tick();

setInterval(() => {
  void tick();
}, workerConfig.tickIntervalMs);
