/**
 * CRM core — contacts, conversations, messages, consents. Typed mirror of
 * migration 0007. The lead/conversation spine of the SDR engine.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, timestamps, users } from "./identity";

export const channel = pgEnum("channel", ["form", "email", "sms", "chat", "voice"]);
export const conversationStatus = pgEnum("conversation_status", [
  "new",
  "active",
  "booked",
  "disqualified",
  "handed_off",
  "closed",
]);
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageAuthor = pgEnum("message_author", ["contact", "assistant", "human"]);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email"),
    phone: text("phone"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    source: text("source"),
    timezone: text("timezone"), // IANA; best-effort (lead-form browser tz). Picks nudge send windows.
    // Most recent message / conversation / call; kept by a trigger (0038), never by app code.
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    index("contacts_org_id_idx").on(t.orgId),
    index("contacts_org_activity_idx").on(t.orgId, t.lastActivityAt.desc(), t.id.desc()),
    // One contact per person and org (0007 for email, 0037 for phone); the resolver merges duplicates.
    uniqueIndex("contacts_org_email_unique").on(t.orgId, sql`lower(${t.email})`).where(sql`${t.email} is not null`),
    uniqueIndex("contacts_org_phone_unique").on(t.orgId, t.phone).where(sql`${t.phone} is not null`),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: channel("channel").notNull(),
    status: conversationStatus("status").notNull().default("new"),
    fitScore: integer("fit_score"),
    scoreReasons: text("score_reasons"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    leadReceivedAt: timestamp("lead_received_at", { withTimezone: true }).notNull().defaultNow(),
    firstReplySentAt: timestamp("first_reply_sent_at", { withTimezone: true }),
    /** Why the agent could not work this lead; speed to lead leaves it out. Null = it could. */
    agentSkipped: text("agent_skipped", { enum: ["disabled", "over-allowance", "suppressed"] }),
    /** The latest reply was written but not delivered; null once one goes through. */
    replyFailedAt: timestamp("reply_failed_at", { withTimezone: true }),
    replyError: text("reply_error"),
    ...timestamps,
  },
  (t) => [
    index("conversations_org_id_idx").on(t.orgId),
    index("conversations_org_created_idx").on(t.orgId, t.createdAt.desc(), t.id.desc()),
    index("conversations_contact_id_idx").on(t.contactId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: messageDirection("direction").notNull(),
    author: messageAuthor("author").notNull(),
    channel: channel("channel").notNull(),
    body: text("body").notNull(),
    providerRef: text("provider_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_org_id_idx").on(t.orgId),
    index("messages_conversation_id_idx").on(t.conversationId),
  ],
);

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: channel("channel").notNull(),
    basis: text("basis").notNull(),
    verbatim: text("verbatim"),
    source: text("source"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consents_org_id_idx").on(t.orgId),
    index("consents_contact_id_idx").on(t.contactId),
  ],
);

export type Channel = (typeof channel.enumValues)[number];
export type ConversationStatus = (typeof conversationStatus.enumValues)[number];
export type MessageDirection = (typeof messageDirection.enumValues)[number];
export type MessageAuthor = (typeof messageAuthor.enumValues)[number];
