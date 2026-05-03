import { workerConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { startNostrIndexer } from "./nostr/indexer.js";

const appName = "relaypress";

async function tick() {
  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: appName,
    status: "running",
    timestamp: new Date().toISOString(),
  }));
}

await initializeDatabase();
await startNostrIndexer();
await tick();

setInterval(() => {
  void tick();
}, workerConfig.tickIntervalMs);
