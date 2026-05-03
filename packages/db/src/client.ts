import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

export function createPgPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({ connectionString });
}

export function createDb(connectionString = process.env.DATABASE_URL) {
  const pool = createPgPool(connectionString);
  const db = drizzle(pool, { schema });

  return { db, pool };
}

export type RelayPressDb = ReturnType<typeof createDb>["db"];
