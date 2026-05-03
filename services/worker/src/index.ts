import { RELAYPRESS_APP_NAME } from "@relaypress/shared";
import { workerConfig } from "./config";
import { startNostrIndexer } from "./nostr/indexer";

async function tick() {
  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: RELAYPRESS_APP_NAME,
    status: "running",
    timestamp: new Date().toISOString(),
  }));
}

await startNostrIndexer();
await tick();

setInterval(() => {
  void tick();
}, workerConfig.tickIntervalMs);
