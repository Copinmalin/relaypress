import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const nostrEvents = pgTable(
  "nostr_events",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    pubkey: varchar("pubkey", { length: 128 }).notNull(),
    kind: integer("kind").notNull(),
    content: text("content").notNull().default(""),
    tags: jsonb("tags").notNull().$type<string[][]>(),
    sig: varchar("sig", { length: 256 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb("raw").notNull().$type<Record<string, unknown>>(),
  },
  (table) => ({
    pubkeyIdx: index("nostr_events_pubkey_idx").on(table.pubkey),
    kindIdx: index("nostr_events_kind_idx").on(table.kind),
    createdAtIdx: index("nostr_events_created_at_idx").on(table.createdAt),
  }),
);

export const publicationJobs = pgTable(
  "publication_jobs",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    sourceEventId: varchar("source_event_id", { length: 128 }).references(() => nostrEvents.id),
    platform: varchar("platform", { length: 64 }).notNull(),
    status: varchar("status", { length: 64 }).notNull().default("drafted"),
    sourceContent: text("source_content"),
    adaptedContent: text("adapted_content"),
    externalPostId: varchar("external_post_id", { length: 256 }),
    errorMessage: text("error_message"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceEventIdx: index("publication_jobs_source_event_idx").on(table.sourceEventId),
    platformIdx: index("publication_jobs_platform_idx").on(table.platform),
    statusIdx: index("publication_jobs_status_idx").on(table.status),
  }),
);

export const publicationJobRuns = pgTable(
  "publication_job_runs",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    jobId: varchar("job_id", { length: 128 }).notNull().references(() => publicationJobs.id),
    platform: varchar("platform", { length: 64 }).notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    mode: varchar("mode", { length: 64 }).notNull(),
    externalPostId: varchar("external_post_id", { length: 256 }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    rawResponse: jsonb("raw_response").$type<Record<string, unknown>>(),
  },
  (table) => ({
    jobIdx: index("publication_job_runs_job_idx").on(table.jobId),
    platformIdx: index("publication_job_runs_platform_idx").on(table.platform),
    statusIdx: index("publication_job_runs_status_idx").on(table.status),
    startedAtIdx: index("publication_job_runs_started_at_idx").on(table.startedAt),
  }),
);
