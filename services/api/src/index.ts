import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3000);

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  status: "ok",
  service: "relaypress-api",
  timestamp: new Date().toISOString(),
}));

app.get("/", async () => ({
  name: "RelayPress API",
  description: "Sovereign editorial orchestration powered by Nostr",
}));

await app.listen({ host: "0.0.0.0", port });
