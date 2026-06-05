import { workerConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { startNostrIndexer } from "./nostr/indexer.js";
import { processApprovedPublicationJobs } from "./publisher/index.js";
import { ingestBtcBreakdownIfDue } from "./sources/btcbreakdown.js";

const appName = "relaypress";

async function tick() {
  const sourceIngest = await ingestBtcBreakdownIfDue({
    enabled: workerConfig.btcBreakdownIngestEnabled,
    baseUrl: workerConfig.btcBreakdownBaseUrl,
    feedUrls: workerConfig.btcBreakdownFeedUrls,
    maxItems: workerConfig.btcBreakdownMaxItems,
    intervalMs: workerConfig.btcBreakdownIngestIntervalMs,
  });
  const publishedJobs = await processApprovedPublicationJobs();

  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: appName,
    status: "running",
    publisherMode: workerConfig.publisherMode,
    sourceIngest,
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
