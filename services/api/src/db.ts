import { createPgPool, ensureSourceItemsTable, migrate } from "@relaypress/db";

export const pool = createPgPool();

export async function migrateDatabase(): Promise<void> {
  await migrate(pool);
  await ensureSourceItemsTable(pool);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
