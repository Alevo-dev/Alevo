/**
 * The Qualifier's per-org context. Typed mirror of migration 0008.
 *
 * One row per org (`org_id` unique → upsert-friendly). Edited by admins in
 * Settings → Qualifier; read by the Qualifier when it reasons over a lead.
 */
import { boolean, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { organizations, timestamps } from "./identity";

export const orgProfiles = pgTable(
  "org_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyName: text("company_name"),
    offering: text("offering"),
    idealCustomer: text("ideal_customer"),
    qualifyingCriteria: text("qualifying_criteria"),
    disqualifiers: text("disqualifiers"),
    tone: text("tone"),
    signoff: text("signoff"),
    enabled: boolean("enabled").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("org_profiles_org_id_idx").on(t.orgId)],
);

export type OrgProfile = typeof orgProfiles.$inferSelect;
