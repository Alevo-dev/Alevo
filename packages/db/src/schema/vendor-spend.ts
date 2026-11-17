/**
 * What each vendor call costs us, per environment (migration 0051). Service path only; written by the app,
 * read by the admin console.
 */
import { boolean, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const vendorSpend = pgTable("vendor_spend", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  env: text("env").notNull(),
  provider: text("provider").notNull(),
  kind: text("kind").notNull(),
  orgId: uuid("org_id"),
  units: numeric("units").notNull().default("0"),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  estimated: boolean("estimated").notNull().default(true),
  detail: text("detail"),
});
