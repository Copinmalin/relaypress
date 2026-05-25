import { workerConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { startNostrIndexer } from "./nostr/indexer.js";
import { processApprovedPublicationJobs } from "./publisher/index.js";
import { fetchBtcBreakdownSources } from "./sources/btcbreakdown.js";

const appName = "relaypress";

async function tick() {
  const publishedJobs = await processApprovedPublicationJobs();
  const sourceFetch = await fetchBtcBreakdownSources();

  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: appName,
    status: "running",
    publisherMode: workerConfig.publisherMode,
    publishedJobs,
    sourceFetch,
    timestamp: new Date().toISOString(),
  }));
}

await initializeDatabase();
await startNostrIndexer();
await tick();

setInterval(() => {
  void tick();
}, workerConfig.tickIntervalMs);