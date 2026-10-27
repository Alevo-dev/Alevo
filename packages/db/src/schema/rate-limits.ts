/**
 * Fixed-window counters for public endpoints (migration 0021). One row per
 * key; see `hitRateLimit` for the atomic bump. Service path only.
 */
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
