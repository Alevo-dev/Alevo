import { defineConfig } from "drizzle-kit";

/**
 * Used only for `drizzle-kit pull` (introspect the DB back into typed schema).
 * The DB is authoritative — schema is generated FROM it, never pushed TO it.
 * Uses the DIRECT connection (port 5432), not the pooler.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
