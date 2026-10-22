/**
 * Inbound voice calls. Typed mirror of migration 0018. One row per call that
 * Vapi reports as ended; written via the service path, tenant-scoped reads.
 */
import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./identity";
import { contacts, conversations } from "./conversations";

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    provider: text("provider").notNull().default("vapi"),
    providerRef: text("provider_ref").notNull(),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    endedReason: text("ended_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSec: integer("duration_sec"),
    summary: text("summary"),
    transcript: text("transcript"),
    recordingKey: text("recording_key"),
    outcome: text("outcome"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("calls_org_provider_ref_unique").on(t.orgId, t.providerRef),
    index("calls_org_started_idx").on(t.orgId, t.startedAt),
    index("calls_contact_idx").on(t.contactId),
  ],
);

export type CallOutcome = "booked" | "handed_off" | "disqualified" | "escalated" | "voicemail" | "none";
