/**
 * CRM core — contacts, conversations, messages, consents. Typed mirror of
 * migration 0007. The lead/conversation spine of the SDR engine.
 */
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
    ...timestamps,
  },
  (t) => [index("contacts_org_id_idx").on(t.orgId)],
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
    ...timestamps,
  },
  (t) => [
    index("conversations_org_id_idx").on(t.orgId),
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
