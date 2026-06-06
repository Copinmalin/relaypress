export declare function createPgPool(connectionString?: string): unknown;

export declare function createDb(connectionString?: string): {
  db: unknown;
  pool: unknown;
};

export declare function migrate(pool: unknown): Promise<void>;

export type RelayPressDb = unknown;

export declare const nostrEvents: unknown;
export declare const sourceItems: unknown;
export declare const editorialSignals: unknown;
export declare const publicationJobs: unknown;
export declare const publicationJobRuns: unknown;
export declare const publisherAccounts: unknown;
