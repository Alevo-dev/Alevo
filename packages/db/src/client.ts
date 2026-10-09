import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
/** The transaction handle Drizzle hands to `db.transaction(tx => ...)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let cached: Db | undefined;

/**
 * Lazily-created singleton Drizzle client over the Supavisor transaction pooler.
 *
 * `prepare: false` is REQUIRED: in transaction-pooling mode consecutive
 * statements may run on different backend connections, which breaks cached
 * prepared statements. Lazy init keeps `next build` from opening a connection
 * for routes that never touch the database.
 */
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set — cannot connect to Postgres");
    cached = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return cached;
}
