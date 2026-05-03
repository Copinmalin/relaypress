import type pg from "pg";

export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists nostr_events (
      id varchar(128) primary key,
      pubkey varchar(128) not null,
      kind integer not null,
      content text not null default '',
      tags jsonb not null,
      sig varchar(256) not null,
      created_at timestamptz not null,
      indexed_at timestamptz not null default now(),
      raw jsonb not null
    );

    create index if not exists nostr_events_pubkey_idx on nostr_events(pubkey);
    create index if not exists nostr_events_kind_idx on nostr_events(kind);
    create index if not exists nostr_events_created_at_idx on nostr_events(created_at);

    create table if not exists publication_jobs (
      id varchar(128) primary key,
      source_event_id varchar(128) references nostr_events(id),
      platform varchar(64) not null,
      status varchar(64) not null default 'drafted',
      adapted_content text,
      external_post_id varchar(256),
      error_message text,
      scheduled_at timestamptz,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists publication_jobs_source_event_idx on publication_jobs(source_event_id);
    create index if not exists publication_jobs_platform_idx on publication_jobs(platform);
    create index if not exists publication_jobs_status_idx on publication_jobs(status);
  `);
}
