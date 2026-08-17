import pg from 'pg';
import { readFile } from 'node:fs/promises';

const { Pool } = pg;
export const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function migrate() {
  const sql = await readFile(new URL('../db/001_init.sql', import.meta.url), 'utf8');
  await db.query(sql);
}
