import { workerConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { startNostrIndexer } from "./nostr/indexer.js";
import { processApprovedPublicationJobs } from "./publisher/index.js";

const appName = "relaypress";

async function tick() {
  const publishedJobs = await processApprovedPublicationJobs();

  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: appName,
    status: "running",
    publisherMode: workerConfig.publisherMode,
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
