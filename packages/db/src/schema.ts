/**
 * Drizzle schema — the typed mirror of the SQL in `supabase/migrations/`.
 *
 * The SQL migrations are the single source of truth (they also hold RLS
 * policies, the `app.*` helper functions, and grants that Drizzle can't
 * express). Keep this file in sync by hand, or regenerate with
 * `pnpm --filter @alevo/db db:pull` after a migration lands.
 */
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** App roles live in OUR database (plan.md rule 4), not in Clerk. */
export const appRole = pgEnum("app_role", ["viewer", "rep", "admin", "owner"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Tenants. Mirrored from Clerk organizations via webhook. */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug"),
  ...timestamps,
});

/** People. Mirrored from Clerk users via webhook. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  ...timestamps,
});

/** Org ↔ user link, carrying the canonical app role. */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRole("role").notNull().default("rep"),
    clerkMembershipId: text("clerk_membership_id").unique(),
    ...timestamps,
  },
  (t) => [
    unique("memberships_org_user_unique").on(t.orgId, t.userId),
    index("memberships_org_id_idx").on(t.orgId),
    index("memberships_user_id_idx").on(t.userId),
  ],
);

/**
 * Idempotency ledger for every inbound webhook (plan.md rule 7). Not tenant
 * scoped — RLS is enabled with no policy, so only the service path writes it.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("webhook_events_provider_event_unique").on(t.provider, t.eventId)],
);

export const schema = { organizations, users, memberships, webhookEvents, appRole };
export type AppRole = (typeof appRole.enumValues)[number];
