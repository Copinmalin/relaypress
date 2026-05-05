import { createPgPool, migrate } from "@relaypress/db";

export const pool = createPgPool();

export async function migrateDatabase(): Promise<void> {
  await migrate(pool);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
