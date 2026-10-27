import "server-only";
import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contacts, conversations, meetings, orgProfiles, withService } from "@alevo/db";
import { displayName, fmtDateTime } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/ui/status";
import { notifySlack } from "./slack";
import { meetingBookedMessage, qualifiedLeadMessage, unansweredLeadMessage, type LeadLine, type UnansweredReason } from "./lead-messages";

/**
 * Post lead milestones to the org's Slack (Integrations → Slack): a lead that
 * first scores a strong fit, a meeting that lands on the calendar, and the
 * fallback — a lead nobody answered. Called from the Qualifier / voice tools,
 * the booking webhooks and the Inngest functions. Best-effort and never throws:
 * a Slack failure must not touch the reply or the webhook.
 */

async function loadLead(orgId: string, conversationId: string): Promise<(LeadLine & { timezone: string | null; status: string }) | null> {
  const [row] = await withService((tx) =>
    tx
      .select({
        status: conversations.status,
        channel: conversations.channel,
        fitScore: conversations.fitScore,
        scoreReasons: conversations.scoreReasons,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        company: contacts.company,
        timezone: orgProfiles.timezone,
      })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .leftJoin(orgProfiles, eq(orgProfiles.orgId, conversations.orgId))
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
      .limit(1),
  );
  if (!row) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return {
    name: displayName(row.firstName, row.lastName, row.email ?? row.phone),
    company: row.company,
    email: row.email,
    phone: row.phone,
    channel: CHANNEL_LABEL[row.channel],
    fitScore: row.fitScore,
    scoreReasons: row.scoreReasons,
    link: appUrl ? `${appUrl}/conversations/${conversationId}` : null,
    timezone: row.timezone,
    status: row.status,
  };
}

export async function notifyQualifiedLead(orgId: string, conversationId: string): Promise<void> {
  try {
    const lead = await loadLead(orgId, conversationId);
    if (lead) await notifySlack(orgId, qualifiedLeadMessage(lead));
  } catch (err) {
    Sentry.captureException(err);
  }
}

export async function notifyMeetingBooked(orgId: string, conversationId: string): Promise<void> {
  try {
    const lead = await loadLead(orgId, conversationId);
    if (!lead) return;
    const [meeting] = await withService((tx) =>
      tx
        .select({ startAt: meetings.startAt, joinUrl: meetings.joinUrl })
        .from(meetings)
        .where(and(eq(meetings.conversationId, conversationId), eq(meetings.orgId, orgId)))
        .orderBy(desc(meetings.createdAt))
        .limit(1),
    );
    const when = meeting?.startAt ? fmtDateTime(meeting.startAt, lead.timezone ?? undefined) : null;
    await notifySlack(orgId, meetingBookedMessage(lead, { when, joinUrl: meeting?.joinUrl ?? null }));
  } catch (err) {
    Sentry.captureException(err);
  }
}

/**
 * The fallback. Only for a lead still being worked (new / active): it is marked
 * "handed to a rep" so the dashboard and inbox show a person owes a reply, and
 * the org's Slack gets who / why / how to reach them. A lead already handed off,
 * booked or closed is left alone, so one lead never alerts twice.
 * Returns true when it alerted.
 */
export async function notifyUnansweredLead(orgId: string, conversationId: string, reason: UnansweredReason, after?: string): Promise<boolean> {
  try {
    const lead = await loadLead(orgId, conversationId);
    if (!lead || (lead.status !== "new" && lead.status !== "active")) return false;
    const updated = await withService((tx) =>
      tx
        .update(conversations)
        .set({ status: "handed_off", updatedAt: new Date() })
        .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), inArray(conversations.status, ["new", "active"])))
        .returning({ id: conversations.id }),
    );
    if (updated.length === 0) return false; // someone else got there first
    await notifySlack(orgId, unansweredLeadMessage(lead, reason, after));
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}
