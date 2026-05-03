import { createPgPool } from "@relaypress/db";

export const pool = createPgPool();

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
