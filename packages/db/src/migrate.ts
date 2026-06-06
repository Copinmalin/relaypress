import type { Pool } from "pg";

export async function migrate(pool: Pool): Promise<void> {
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

    create table if not exists source_items (
      id varchar(128) primary key,
      provider varchar(64) not null,
      source_url text not null,
      canonical_url text not null,
      title text not null,
      excerpt text,
      language varchar(16) not null default 'en',
      status varchar(64) not null default 'new',
      metadata jsonb not null default '{}'::jsonb,
      fetched_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists source_items_provider_idx on source_items(provider);
    create index if not exists source_items_status_idx on source_items(status);
    create index if not exists source_items_fetched_at_idx on source_items(fetched_at);
    create unique index if not exists source_items_provider_canonical_url_idx on source_items(provider, canonical_url);

    create table if not exists editorial_signals (
      id varchar(128) primary key,
      source_item_id varchar(128) not null references source_items(id),
      category varchar(64) not null,
      summary_internal text not null,
      editorial_angle text not null,
      risk_level varchar(64) not null default 'medium',
      status varchar(64) not null default 'qualified',
      primary_sources jsonb not null default '[]'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists editorial_signals_source_item_idx on editorial_signals(source_item_id);
    create index if not exists editorial_signals_category_idx on editorial_signals(category);
    create index if not exists editorial_signals_status_idx on editorial_signals(status);
    create index if not exists editorial_signals_risk_level_idx on editorial_signals(risk_level);
    create index if not exists editorial_signals_created_at_idx on editorial_signals(created_at);

    create table if not exists publication_jobs (
      id varchar(128) primary key,
      source_event_id varchar(128) references nostr_events(id),
      platform varchar(64) not null,
      status varchar(64) not null default 'drafted',
      source_content text,
      adapted_content text,
      external_post_id varchar(256),
      error_message text,
      scheduled_at timestamptz,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table publication_jobs add column if not exists source_content text;

    update publication_jobs
    set source_content = adapted_content
    where source_content is null and adapted_content is not null;

    create index if not exists publication_jobs_source_event_idx on publication_jobs(source_event_id);
    create index if not exists publication_jobs_platform_idx on publication_jobs(platform);
    create index if not exists publication_jobs_status_idx on publication_jobs(status);

    create table if not exists publication_job_runs (
      id varchar(128) primary key,
      job_id varchar(128) not null references publication_jobs(id),
      platform varchar(64) not null,
      status varchar(64) not null,
      mode varchar(64) not null,
      external_post_id varchar(256),
      error_message text,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      raw_response jsonb
    );

    create index if not exists publication_job_runs_job_idx on publication_job_runs(job_id);
    create index if not exists publication_job_runs_platform_idx on publication_job_runs(platform);
    create index if not exists publication_job_runs_status_idx on publication_job_runs(status);
    create index if not exists publication_job_runs_started_at_idx on publication_job_runs(started_at);

    create table if not exists publisher_accounts (
      id varchar(128) primary key,
      provider varchar(64) not null,
      account_urn varchar(256) not null,
      display_name varchar(256),
      status varchar(64) not null default 'connected',
      scopes jsonb not null default '[]'::jsonb,
      encrypted_access_token text not null,
      encrypted_refresh_token text,
      token_expires_at timestamptz,
      refresh_token_expires_at timestamptz,
      last_validated_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create unique index if not exists publisher_accounts_provider_account_idx on publisher_accounts(provider, account_urn);
    create index if not exists publisher_accounts_provider_idx on publisher_accounts(provider);
    create index if not exists publisher_accounts_status_idx on publisher_accounts(status);
  `);
}
