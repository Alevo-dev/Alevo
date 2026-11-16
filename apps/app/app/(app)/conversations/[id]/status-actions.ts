"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { calls, contacts, conversations, messages, recordAudit, safeErrorMessage, withService } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { requestPsaWriteback } from "@/lib/psa/request";
import { notifyHandoff } from "@/lib/qualifier/tools";

export type StatusState = { ok?: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The active org's conversation (explicit org filter), with who it is with; null when it is not ours. */
async function load(orgId: string, id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await withOrg((tx) =>
    tx
      .select({ id: conversations.id, status: conversations.status, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)))
      .limit(1),
  );
  return row ?? null;
}

async function audit(orgId: string, action: string, target: string, metadata?: Record<string, unknown>) {
  const me = await getCurrentUser();
  await recordAudit({ orgId, actorUserId: me?.id ?? null, action, target, metadata });
}

/**
 * A rep (or above) hands the conversation to a person: status handed_off, the
 * team is alerted like an agent hand-off (Slack + email), the PSA write-back is
 * requested. Already handed off (or booked): nothing is sent twice.
 */
export async function handOffConversation(_prev: StatusState, formData: FormData): Promise<StatusState> {
  try {
    await requireRole("rep");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization." };
    const conv = await load(org.id, String(formData.get("conversationId") ?? ""));
    if (!conv) return { error: "Conversation not found." };
    if (conv.status === "handed_off") return { error: "This conversation is already handed off." };
    if (conv.status === "booked") return { error: "A meeting is already booked, so there is nothing to hand off." };

    const changed = await withOrg((tx) =>
      tx
        .update(conversations)
        .set({ status: "handed_off", updatedAt: new Date() })
        .where(and(eq(conversations.id, conv.id), eq(conversations.orgId, org.id), ne(conversations.status, "handed_off"), ne(conversations.status, "booked")))
        .returning({ id: conversations.id }),
    );
    if (changed.length === 0) return { error: "This conversation changed. Refresh and try again." };

    const contactName = [conv.firstName, conv.lastName].filter(Boolean).join(" ").trim() || conv.email || "unknown contact";
    await notifyHandoff({ orgId: org.id, conversationId: conv.id, contactName, contactEmail: conv.email });
    await requestPsaWriteback(org.id, conv.id, "handed_off");
    await audit(org.id, "conversation.handed_off", conv.id, { from: conv.status });
    revalidatePath(`/conversations/${conv.id}`);
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong") };
  }
}

/** Not a fit: status disqualified. The follow-up cadence only works new/active threads, so it stops. */
export async function markNotFit(_prev: StatusState, formData: FormData): Promise<StatusState> {
  try {
    await requireRole("rep");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization." };
    const conv = await load(org.id, String(formData.get("conversationId") ?? ""));
    if (!conv) return { error: "Conversation not found." };
    if (conv.status === "disqualified") return { error: "This conversation is already marked not a fit." };
    if (conv.status === "booked") return { error: "A meeting is already booked. Cancel it first." };

    await withOrg((tx) =>
      tx
        .update(conversations)
        .set({ status: "disqualified", updatedAt: new Date() })
        .where(and(eq(conversations.id, conv.id), eq(conversations.orgId, org.id), ne(conversations.status, "booked"))),
    );
    await audit(org.id, "conversation.marked_not_fit", conv.id, { from: conv.status });
    revalidatePath(`/conversations/${conv.id}`);
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong") };
  }
}

/**
 * Admin and above: delete the conversation with its messages and call rows (calls
 * are tenant-read-only, so they go through the service path, scoped by org id).
 * Meetings keep their row (the link just clears). Recordings in storage are not removed.
 */
export async function deleteConversation(_prev: StatusState, formData: FormData): Promise<StatusState> {
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization." };
    const id = String(formData.get("conversationId") ?? "");
    const conv = await load(org.id, id);
    if (!conv) return { error: "Conversation not found." };

    await withService(async (tx) => {
      await tx.delete(messages).where(and(eq(messages.conversationId, conv.id), eq(messages.orgId, org.id)));
      await tx.delete(calls).where(and(eq(calls.conversationId, conv.id), eq(calls.orgId, org.id)));
      await tx.delete(conversations).where(and(eq(conversations.id, conv.id), eq(conversations.orgId, org.id)));
    });
    await audit(org.id, "conversation.deleted", conv.id, { status: conv.status });
    revalidatePath("/conversations");
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong") };
  }
  redirect("/conversations");
}

/** On the client page: every open (new / active) conversation of this client becomes not a fit. */
export async function markClientNotFit(_prev: StatusState, formData: FormData): Promise<StatusState> {
  try {
    await requireRole("rep");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization." };
    const contactId = String(formData.get("contactId") ?? "");
    if (!UUID.test(contactId)) return { error: "Client not found." };
    const done = await withOrg((tx) =>
      tx
        .update(conversations)
        .set({ status: "disqualified", updatedAt: new Date() })
        .where(and(eq(conversations.contactId, contactId), eq(conversations.orgId, org.id), inArray(conversations.status, ["new", "active"])))
        .returning({ id: conversations.id }),
    );
    if (done.length === 0) return { error: "This client has no open conversations." };
    await audit(org.id, "client.marked_not_fit", contactId, { conversations: done.length });
    revalidatePath(`/conversations/client/${contactId}`);
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong") };
  }
}
