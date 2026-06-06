type InsertResult = {
  returning<T extends Record<string, unknown>>(selection: T): Promise<Array<{ [K in keyof T]: string }>>;
};

type InsertValues = {
  onConflictDoNothing(): InsertResult;
};

type DbClient = {
  insert(table: unknown): {
    values(value: Record<string, unknown>): InsertValues;
  };
};

type PoolLike = {
  query(query: string, values?: unknown[]): Promise<unknown>;
  end(): Promise<void>;
};

type TableWithId = {
  id: unknown;
};

export declare function createPgPool(connectionString?: string): PoolLike;

export declare function createDb(connectionString?: string): {
  db: DbClient;
  pool: PoolLike;
};

export declare function migrate(pool: PoolLike): Promise<void>;

export type RelayPressDb = DbClient;

export declare const nostrEvents: TableWithId;
export declare const sourceItems: TableWithId;
export declare const editorialSignals: TableWithId;
export declare const publicationJobs: TableWithId;
export declare const publicationJobRuns: TableWithId;
export declare const publisherAccounts: TableWithId;
