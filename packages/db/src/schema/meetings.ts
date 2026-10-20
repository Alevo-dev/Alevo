/**
 * Booked meetings. Typed mirror of migration 0013. Written by the Qualifier's
 * booking tools and kept in sync by the provider webhook (Cal.com first).
 */
import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, timestamps } from "./identity";
import { contacts, conversations } from "./conversations";

export const bookingProvider = pgEnum("booking_provider", [
  "calcom",
  "calendly",
  "google",
  "m365",
  "manual",
]);
export const meetingStatus = pgEnum("meeting_status", [
  "scheduled",
  "rescheduled",
  "cancelled",
  "completed",
  "no_show",
]);
/** Post-meeting result a rep marks (distinct from the booking-lifecycle status). */
export const meetingOutcome = pgEnum("meeting_outcome", ["pending", "showed", "no_show"]);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    provider: bookingProvider("provider").notNull(),
    providerRef: text("provider_ref"),
    status: meetingStatus("status").notNull().default("scheduled"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    joinUrl: text("join_url"),
    outcome: meetingOutcome("outcome").notNull().default("pending"),
    converted: boolean("converted").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("meetings_org_id_idx").on(t.orgId),
    index("meetings_conversation_id_idx").on(t.conversationId),
  ],
);

export type Meeting = typeof meetings.$inferSelect;
export type MeetingStatus = (typeof meetingStatus.enumValues)[number];
export type MeetingOutcome = (typeof meetingOutcome.enumValues)[number];
export type BookingProvider = (typeof bookingProvider.enumValues)[number];
