/**
 * Billing + usage metering tables. Typed mirror of migration 0002.
 *
 * `plans` is global reference data (the three tiers). `org_subscriptions` and
 * `usage_counters` are tenant-scoped. Usage is metered before it is spent
 * (plan.md rule 11): the service path increments counters; tenants read them.
 */
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, timestamps } from "./identity";

export const planKey = pgEnum("plan_key", ["starter", "growth", "scale"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
]);

/** The metered dimensions that count against a plan's monthly allowance. */
export const usageMetric = pgEnum("usage_metric", [
  "inbound_conversations",
  "voice_minutes",
  "outbound_dials",
  "sourced_leads",
  "prospecting_emails",
]);

/** The three pricing tiers (plan.md §6). Platform-managed reference data. */
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: planKey("key").notNull().unique(),
  name: text("name").notNull(),
  /** Monthly price in USD cents (exact; avoids float rounding). */
  priceCents: integer("price_cents").notNull(),

  // Monthly metered allowances (mirror usage_metric).
  inboundConversations: integer("inbound_conversations").notNull(),
  voiceMinutes: integer("voice_minutes").notNull(),
  outboundDials: integer("outbound_dials").notNull(),
  sourcedLeads: integer("sourced_leads").notNull(),
  prospectingEmails: integer("prospecting_emails").notNull(),

  // Capacity limits (not per-period usage).
  sendingDomains: integer("sending_domains").notNull(),
  mailboxes: integer("mailboxes").notNull(),
  phoneNumbers: integer("phone_numbers").notNull(),
  psaIntegrations: integer("psa_integrations").notNull(),

  coachingIncluded: boolean("coaching_included").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

/** One current subscription per org. */
export const orgSubscriptions = pgTable("org_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  status: subscriptionStatus("status").notNull().default("active"),
  currentPeriodStart: date("current_period_start"),
  currentPeriodEnd: date("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  ...timestamps,
});

/** One counter per (org, metric, billing period). Incremented by the service path. */
export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    metric: usageMetric("metric").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    used: integer("used").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("usage_counters_org_metric_period_unique").on(t.orgId, t.metric, t.periodStart),
    index("usage_counters_org_id_idx").on(t.orgId),
  ],
);

export type PlanKey = (typeof planKey.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number];
export type UsageMetric = (typeof usageMetric.enumValues)[number];
