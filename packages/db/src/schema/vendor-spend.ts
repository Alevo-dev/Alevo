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
  /** The conversation an AI call was for (0054); no foreign key. */
  conversationId: uuid("conversation_id"),
  /** AI calls only (0053): what went in and what came out, with the cost of each. Null on older rows. */
  inputTokens: numeric("input_tokens"),
  outputTokens: numeric("output_tokens"),
  inputCostUsd: numeric("input_cost_usd", { precision: 12, scale: 6 }),
  outputCostUsd: numeric("output_cost_usd", { precision: 12, scale: 6 }),
});
