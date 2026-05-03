import { RELAYPRESS_APP_NAME } from "@relaypress/shared";

const intervalMs = Number(process.env.WORKER_TICK_INTERVAL_MS ?? 30_000);

async function tick() {
  console.log(JSON.stringify({
    service: "relaypress-worker",
    app: RELAYPRESS_APP_NAME,
    status: "idle",
    timestamp: new Date().toISOString(),
  }));
}

await tick();
setInterval(() => {
  void tick();
}, intervalMs);
