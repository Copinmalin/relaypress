import { workerConfig } from "./config";
import { startNostrIndexer } from "./nostr/indexer";

const appName = "relaypress";

async function tick() {
  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: appName,
    status: "running",
    timestamp: new Date().toISOString(),
  }));
}

await startNostrIndexer();
await tick();

setInterval(() => {
  void tick();
}, workerConfig.tickIntervalMs);
