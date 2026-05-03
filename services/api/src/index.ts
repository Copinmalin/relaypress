import Fastify from "fastify";
import cors from "@fastify/cors";
import { closeDatabase } from "./db.js";
import { registerPublicationJobRoutes } from "./publication-jobs.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3000);

await app.register(cors, { origin: true });
await registerPublicationJobRoutes(app);

app.get("/health", async () => ({
  status: "ok",
  service: "relaypress-api",
  timestamp: new Date().toISOString(),
}));

app.get("/", async () => ({
  name: "RelayPress API",
  description: "Sovereign editorial orchestration powered by Nostr",
}));

const shutdown = async () => {
  await closeDatabase();
  await app.close();
};

process.once("SIGTERM", () => {
  shutdown().catch((error) => app.log.error(error));
});

process.once("SIGINT", () => {
  shutdown().catch((error) => app.log.error(error));
});

await app.listen({ host: "0.0.0.0", port });
