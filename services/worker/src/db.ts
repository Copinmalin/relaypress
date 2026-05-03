import { createDb, migrate } from "@relaypress/db";

const { db, pool } = createDb();

export async function initializeDatabase(): Promise<void> {
  await migrate(pool);
  console.log(JSON.stringify({
    service: "relaypress-worker",
    component: "database",
    status: "migrated",
    timestamp: new Date().toISOString(),
  }));
}

export { db, pool };
