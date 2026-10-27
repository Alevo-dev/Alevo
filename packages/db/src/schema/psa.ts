/**
 * PSA write-back ledger. Typed mirror of migration 0022. One row per Alevo
 * record that became a PSA record (company, contact, activity, opportunity),
 * unique per (org, provider, kind, local id) so a replayed write-back finds the
 * existing record instead of creating a second one. Written via the service
 * path; tenants read it (the conversation page lists what was written).
 */
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./identity";

export const psaLinks = pgTable(
  "psa_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    kind: text("kind").notNull(),
    localId: uuid("local_id").notNull(),
    remoteId: text("remote_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("psa_links_once").on(t.orgId, t.provider, t.kind, t.localId),
    index("psa_links_local_idx").on(t.orgId, t.localId),
  ],
);

export type PsaLink = typeof psaLinks.$inferSelect;
