import type { Pool } from "pg";

const sourceItemsSql = [
  "create table if not exists source_items (",
  "id varchar(128) primary key,",
  "provider varchar(64) not null,",
  "source_url text not null,",
  "title text not null,",
  "content text not null default '',",
  "status varchar(64) not null default 'imported',",
  "metadata jsonb not null default '{}'::jsonb,",
  "created_at timestamptz not null default now(),",
  "updated_at timestamptz not null default now()",
  ");",
  "create unique index if not exists source_items_provider_source_url_idx on source_items(provider, source_url);",
  "create index if not exists source_items_provider_idx on source_items(provider);",
  "create index if not exists source_items_status_idx on source_items(status);",
  "create index if not exists source_items_updated_at_idx on source_items(updated_at);",
].join("\n");

export async function ensureSourceItemsTable(pool: Pool): Promise<void> {
  await pool.query(sourceItemsSql);
}
