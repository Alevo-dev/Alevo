/**
 * Webhook delivery log. Typed mirror of migration 0017. One row per inbound
 * webhook from a connected service; written via the service path
 * (recordWebhookDelivery), tenant-scoped reads.
 */
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./identity";

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    outcome: text("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deliveries_org_created_idx").on(t.orgId, t.createdAt)],
);
