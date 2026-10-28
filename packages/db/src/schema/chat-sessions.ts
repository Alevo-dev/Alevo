/**
 * Website chat sessions. Typed mirror of migration 0025. One row per visitor
 * session: the browser holds a random token, we hold its hash, and the token
 * is the only way to read or post on that conversation from the open web.
 * Service path only (no policies): the widget has no session, the app reads
 * the conversation itself through RLS.
 */
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { organizations } from "./identity";

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Bumped on every poll: "is the visitor still on the page?" */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_sessions_conversation_id_idx").on(t.conversationId)],
);
