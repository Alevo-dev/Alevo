import "server-only";
import { and, eq } from "drizzle-orm";
import { calls, conversations, resolveContact, withService } from "@alevo/db";

export type CallThread = { contactId: string; conversationId: string; callId: string };

/**
 * One phone call is one conversation. Every webhook message for a call (tool
 * calls, end-of-call report) resolves through here by Vapi's call id: the first
 * creates the caller's contact (by phone, merged into an existing one when known),
 * a fresh `voice` conversation and a `calls` stub; the rest find them. The next
 * call from the same number starts a new thread. Service path, scoped to the org
 * in code; a parallel first message loses the unique race and re-reads.
 */
export async function callThread(orgId: string, callRef: string, phone: string | null): Promise<CallThread> {
  const existing = await findCall(orgId, callRef);
  if (existing) return existing;

  // A withheld number still gets a thread: an anonymous voice contact, like a chat visitor.
  const { id: contactId } = await resolveContact(orgId, { phone }, { source: "voice" });
  await withService(async (tx) => {
    const [conversation] = await tx
      .insert(conversations)
      .values({ orgId, contactId, channel: "voice", status: "new" })
      .returning({ id: conversations.id });
    if (!conversation) throw new Error("Failed to create conversation");
    const stub = await tx
      .insert(calls)
      .values({ orgId, contactId, conversationId: conversation.id, providerRef: callRef, fromNumber: phone, startedAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: calls.id });
    // Lost the race: another message created the thread first; drop ours.
    if (stub.length === 0) await tx.delete(conversations).where(eq(conversations.id, conversation.id));
  });

  const created = await findCall(orgId, callRef);
  if (!created) throw new Error("Failed to resolve call thread");
  return created;
}

async function findCall(orgId: string, callRef: string): Promise<CallThread | null> {
  const [row] = await withService((tx) =>
    tx
      .select({ callId: calls.id, contactId: calls.contactId, conversationId: calls.conversationId })
      .from(calls)
      .where(and(eq(calls.orgId, orgId), eq(calls.providerRef, callRef)))
      .limit(1),
  );
  return row?.conversationId && row.contactId ? { callId: row.callId, contactId: row.contactId, conversationId: row.conversationId } : null;
}
