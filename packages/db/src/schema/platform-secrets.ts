/**
 * Platform-level encrypted settings (migration 0023): Alevo's own credentials
 * that are not per tenant, e.g. the internal alerts Slack webhook. Service
 * path only; access via setPlatformSecret / getPlatformSecret.
 */
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const platformSecrets = pgTable("platform_secrets", {
  keyName: text("key_name").primaryKey(),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  keyVersion: integer("key_version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
