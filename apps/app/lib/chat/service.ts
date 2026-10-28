import "server-only";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import {
  chatSessions,
  consents,
  contacts,
  conversations,
  hitRateLimit,
  messages,
  organizations,
  orgProfiles,
  withService,
  type ConversationStatus,
} from "@alevo/db";
import { inngest } from "@/lib/inngest/client";
import { clientIp, ipKey } from "@/lib/leads/spam";
import { meterUsage } from "@/lib/usage/limits";
import { CHAT_CONSENT_TEXT, CHAT_LIMITS, DEFAULT_ACCENT, DEFAULT_GREETING, hashToken, newToken, visitorPresent } from "./rules";

/**
 * The website chat, server side. Everything here runs without a session (the
 * widget is on the customer's site), so it goes through the service path,
 * scoped to the org in code, and trusts only the visitor's token.
 */

export type ChatConfig = { enabled: boolean; company: string; greeting: string; accent: string; online: boolean };

/** What the widget needs before it renders. `null` when the org doesn't exist. */
export async function chatConfig(orgId: string): Promise<ChatConfig | null> {
  const [row] = await withService((tx) =>
    tx
      .select({
        name: organizations.name,
        company: orgProfiles.companyName,
        enabled: orgProfiles.chatEnabled,
        greeting: orgProfiles.chatGreeting,
        accent: orgProfiles.chatAccent,
        agentOn: orgProfiles.enabled,
      })
      .from(organizations)
      .leftJoin(orgProfiles, eq(orgProfiles.orgId, organizations.id))
      .where(eq(organizations.id, orgId))
      .limit(1),
  );
  if (!row) return null;
  return {
    enabled: row.enabled ?? false,
    company: row.company?.trim() || row.name,
    greeting: row.greeting?.trim() || DEFAULT_GREETING,
    accent: row.accent || DEFAULT_ACCENT,
    online: row.agentOn ?? false,
  };
}

export type ChatSession = { id: string; orgId: string; conversationId: string; lastSeenAt: Date };

/** The session behind a visitor token, or null. */
export async function resolveSession(orgId: string, token: string): Promise<ChatSession | null> {
  const [row] = await withService((tx) =>
    tx
      .select({ id: chatSessions.id, orgId: chatSessions.orgId, conversationId: chatSessions.conversationId, lastSeenAt: chatSessions.lastSeenAt })
      .from(chatSessions)
      .where(and(eq(chatSessions.orgId, orgId), eq(chatSessions.tokenHash, hashToken(token))))
      .limit(1),
  );
  return row ?? null;
}

/** Record that the visitor is still here. Skipped when it was bumped in the last 20s (polls are frequent). */
export async function touchSession(session: ChatSession, now = Date.now()): Promise<void> {
  if (now - session.lastSeenAt.getTime() < 20_000) return;
  await withService((tx) =>
    tx
      .update(chatSessions)
      .set({ lastSeenAt: new Date(now) })
      .where(eq(chatSessions.id, session.id)),
  );
}

/** Is anyone reading this conversation's widget right now? (Used by the Qualifier to decide where a reply goes.) */
export async function chatVisitorPresent(orgId: string, conversationId: string, now = Date.now()): Promise<boolean> {
  const [row] = await withService((tx) =>
    tx
      .select({ last: sql<Date | null>`max(${chatSessions.lastSeenAt})`.mapWith((v) => (v == null ? null : new Date(v as string))) })
      .from(chatSessions)
      .where(and(eq(chatSessions.orgId, orgId), eq(chatSessions.conversationId, conversationId))),
  );
  return visitorPresent(row?.last ?? null, now);
}

export type ChatMessage = { id: string; author: "contact" | "assistant" | "human"; body: string; createdAt: string };
export type ChatResult<T> = ({ ok: true } & T) | { ok: false; status: 404 | 429 | 500; error: string };

/** Fails OPEN: a limiter outage must never turn a visitor away. */
async function withinLimits(orgId: string, headers: Headers, kind: "start" | "message"): Promise<boolean> {
  try {
    const ip = clientIp(headers);
    const [ipOk, orgOk] = await Promise.all([
      hitRateLimit(ipKey(`chat_${kind}`, ip), CHAT_LIMITS[kind].limit, CHAT_LIMITS[kind].windowSeconds),
      hitRateLimit(`chat:org:${orgId}`, CHAT_LIMITS.org.limit, CHAT_LIMITS.org.windowSeconds),
    ]);
    return ipOk && orgOk;
  } catch (err) {
    Sentry.captureException(err);
    return true;
  }
}

const TOO_MANY = { ok: false, status: 429, error: "Too many messages. Please wait a minute and try again." } as const;

/** Hand the latest inbound message to the Qualifier. A send failure never fails the visitor's message. */
async function notifyQualifier(orgId: string, conversationId: string): Promise<void> {
  try {
    await inngest.send({ name: "conversation/message.received", data: { orgId, conversationId } });
  } catch {
    // the message is stored; the next one (or the watchdog) picks the thread up
  }
}

/**
 * First message of a visit: an anonymous contact, a `chat` conversation with
 * that message, a chat consent record and the session the browser will hold.
 * The contact gets a name and email when the agent learns them mid-chat.
 */
export async function startChat(
  orgId: string,
  body: string,
  meta: { headers: Headers },
): Promise<ChatResult<{ token: string; conversationId: string; message: ChatMessage }>> {
  const config = await chatConfig(orgId);
  if (!config?.enabled) return { ok: false, status: 404, error: "Chat is not available." };
  if (!(await withinLimits(orgId, meta.headers, "start"))) return TOO_MANY;

  const token = newToken();
  try {
    const result = await withService(async (tx) => {
      const [contact] = await tx.insert(contacts).values({ orgId, source: "chat" }).returning({ id: contacts.id });
      if (!contact) throw new Error("Failed to create contact");
      const [conversation] = await tx
        .insert(conversations)
        .values({ orgId, contactId: contact.id, channel: "chat", status: "new" })
        .returning({ id: conversations.id });
      if (!conversation) throw new Error("Failed to create conversation");
      const [message] = await tx
        .insert(messages)
        .values({ orgId, conversationId: conversation.id, direction: "inbound", author: "contact", channel: "chat", body })
        .returning({ id: messages.id, createdAt: messages.createdAt });
      if (!message) throw new Error("Failed to store message");
      await tx
        .insert(consents)
        .values({ orgId, contactId: contact.id, channel: "chat", basis: "chat_initiated", verbatim: CHAT_CONSENT_TEXT, source: "widget" });
      await tx.insert(chatSessions).values({ orgId, conversationId: conversation.id, tokenHash: hashToken(token) });
      return { conversationId: conversation.id, message: { id: message.id, createdAt: message.createdAt } };
    });

    await meterUsage(orgId, "inbound_conversations");
    await notifyQualifier(orgId, result.conversationId);
    return {
      ok: true,
      token,
      conversationId: result.conversationId,
      message: { id: result.message.id, author: "contact", body, createdAt: result.message.createdAt.toISOString() },
    };
  } catch (error) {
    Sentry.captureException(error);
    return { ok: false, status: 500, error: "Could not start the chat. Please try again." };
  }
}

/** A further message on an existing session. */
export async function postChatMessage(session: ChatSession, body: string, meta: { headers: Headers }): Promise<ChatResult<{ message: ChatMessage }>> {
  if (!(await withinLimits(session.orgId, meta.headers, "message"))) return TOO_MANY;
  try {
    const message = await withService(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({ orgId: session.orgId, conversationId: session.conversationId, direction: "inbound", author: "contact", channel: "chat", body })
        .returning({ id: messages.id, createdAt: messages.createdAt });
      if (!row) throw new Error("Failed to store message");
      await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, session.conversationId));
      await tx.update(chatSessions).set({ lastSeenAt: new Date() }).where(eq(chatSessions.id, session.id));
      return row;
    });
    await notifyQualifier(session.orgId, session.conversationId);
    return { ok: true, message: { id: message.id, author: "contact", body, createdAt: message.createdAt.toISOString() } };
  } catch (error) {
    Sentry.captureException(error);
    return { ok: false, status: 500, error: "Could not send. Please try again." };
  }
}

/** The thread since `after` (ISO), oldest first, plus where the conversation stands. */
export async function listChatMessages(session: ChatSession, after: string | null): Promise<{ messages: ChatMessage[]; status: ConversationStatus }> {
  const since = after && Number.isFinite(Date.parse(after)) ? new Date(after) : null;
  return withService(async (tx) => {
    const rows = await tx
      .select({ id: messages.id, author: messages.author, body: messages.body, createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, session.conversationId),
          eq(messages.orgId, session.orgId),
          since ? gt(messages.createdAt, since) : undefined,
        ),
      )
      .orderBy(asc(messages.createdAt))
      .limit(200);
    const [conv] = await tx.select({ status: conversations.status }).from(conversations).where(eq(conversations.id, session.conversationId)).limit(1);
    return {
      messages: rows.map((m) => ({ id: m.id, author: m.author, body: m.body, createdAt: m.createdAt.toISOString() })),
      status: conv?.status ?? "new",
    };
  });
}
