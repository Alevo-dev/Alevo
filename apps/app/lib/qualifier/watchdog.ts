import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { conversations, messages, withService } from "@alevo/db";
import { notifyUnansweredLead } from "@/lib/notifications/lead-events";
import { isAnswered, NO_REPLY_LABEL } from "./unanswered";

export type WatchdogResult = { alerted: boolean; reason: string };

/**
 * Run by the `reply-watchdog` Inngest function once `NO_REPLY_AFTER` has passed
 * since a lead's message. If the conversation is still being worked and nothing
 * went out to the contact after their latest message — the agent failed, never
 * answered, or was off — a person is alerted on the org's Slack and the lead is
 * marked handed off. Leads that were booked, handed off, disqualified or
 * closed in the meantime are left alone.
 */
export async function checkUnanswered(orgId: string, conversationId: string): Promise<WatchdogResult> {
  const row = await withService(async (tx) => {
    const [conv] = await tx
      .select({ status: conversations.status })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
      .limit(1);
    if (!conv) return null;
    const [times] = await tx
      .select({
        lastInbound: sql<Date | null>`max(${messages.createdAt}) filter (where ${messages.direction} = 'inbound')`,
        lastOutbound: sql<Date | null>`max(${messages.createdAt}) filter (where ${messages.direction} = 'outbound')`,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.orgId, orgId), inArray(messages.direction, ["inbound", "outbound"])));
    return { status: conv.status, lastInbound: toDate(times?.lastInbound), lastOutbound: toDate(times?.lastOutbound) };
  });

  if (!row) return { alerted: false, reason: "not-found" };
  if (row.status !== "new" && row.status !== "active") return { alerted: false, reason: `status:${row.status}` };
  if (isAnswered(row.lastInbound, row.lastOutbound)) return { alerted: false, reason: "answered" };

  const alerted = await notifyUnansweredLead(orgId, conversationId, "no-reply", NO_REPLY_LABEL);
  return { alerted, reason: alerted ? "no-reply" : "already-handled" };
}

function toDate(v: Date | string | null | undefined): Date | null {
  return v ? new Date(v) : null;
}
