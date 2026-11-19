import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contacts, conversations, messages, orgProfiles, withService } from "@alevo/db";

/**
 * The website chat's own follow-up, separate from the email/SMS cadence (days apart, send window). A visitor who
 * stops answering gets two short nudges, then the chat is paused ("closed") until they write again. Each `after` is
 * the gap since the previous message. Fixed lines: no model call, so a quiet chat costs nothing.
 */
export const CHAT_NUDGES: ReadonlyArray<{ after: string; body: string; closes?: boolean }> = [
  { after: "3m", body: "Still there? I'm happy to help whenever you're ready." },
  { after: "2m", body: "Just checking in. Is there anything else I can answer for you?" },
  { after: "1m", body: "I'll pause this chat for now. Send a message any time and we'll pick it right back up.", closes: true },
];

/** Statuses a chat can still be nudged in; anything else (booked, handed off, closed...) ends the cadence. */
const WORKABLE: ReadonlySet<string> = new Set(["new", "active"]);

/** Should the next nudge go out? Re-checked right before each one. */
export async function chatNudgeAllowed(orgId: string, conversationId: string): Promise<{ proceed: boolean; reason?: string }> {
  return withService(async (tx) => {
    const [conv] = await tx
      .select({ status: conversations.status, channel: conversations.channel })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
      .limit(1);
    if (!conv) return { proceed: false, reason: "not-found" };
    if (conv.channel !== "chat") return { proceed: false, reason: "not-chat" };
    if (!WORKABLE.has(conv.status)) return { proceed: false, reason: `status:${conv.status}` };

    const [profile] = await tx.select({ enabled: orgProfiles.enabled }).from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1);
    if (!profile?.enabled) return { proceed: false, reason: "disabled" };

    // The newest message is the visitor's: they wrote, the Qualifier owns the thread (the cadence is cancelled anyway).
    const [last] = await tx
      .select({ author: messages.author })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.orgId, orgId)))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (!last || last.author === "contact") return { proceed: false, reason: "contact-replied" };
    return { proceed: true };
  });
}

/** One fixed line, written into the thread; the widget picks it up on its next poll. */
export async function postChatNudge(orgId: string, conversationId: string, body: string): Promise<void> {
  await withService((tx) => tx.insert(messages).values({ orgId, conversationId, direction: "outbound", author: "assistant", channel: "chat", body }));
}

/**
 * Pause the chat. Guarded to workable statuses so a concurrent hand-off or booking is never undone.
 * Returns whether we hold an email or a phone for the visitor, i.e. whether the email/SMS follow-up can take over.
 */
export async function pauseChat(orgId: string, conversationId: string): Promise<{ paused: boolean; reachable: boolean }> {
  return withService(async (tx) => {
    const paused = await tx
      .update(conversations)
      .set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), inArray(conversations.status, ["new", "active"])))
      .returning({ contactId: conversations.contactId });
    const contactId = paused[0]?.contactId;
    if (!contactId) return { paused: false, reachable: false };
    const [c] = await tx.select({ email: contacts.email, phone: contacts.phone }).from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId))).limit(1);
    return { paused: true, reachable: Boolean(c?.email || c?.phone) };
  });
}
