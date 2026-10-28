import "server-only";
import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contacts, conversations, meetings, orgProfiles, withService } from "@alevo/db";
import { anonymousLabel, displayName, fmtDateTime } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/ui/status";
import { notifyOrg } from "./notify";
import {
  bookingFailedEmail,
  bookingFailedMessage,
  meetingBookedMessage,
  qualifiedLeadMessage,
  unansweredLeadMessage,
  type BookingFailure,
  type LeadLine,
  type UnansweredReason,
} from "./lead-messages";

/**
 * Post lead milestones to the org — Slack plus email to the owners/admins, see
 * `notifyOrg`: a lead that first scores a strong fit, a meeting that lands on
 * the calendar, the fallback — a lead nobody answered — and a booking the agent
 * couldn't make. Called from the Qualifier / voice tools, the booking webhooks
 * and the Inngest functions. Best-effort and never throws: a notification
 * failure must not touch the reply or the webhook.
 */

type Lead = LeadLine & {
  timezone: string | null;
  status: string;
  orgName: string | null;
};

async function loadLead(orgId: string, conversationId: string): Promise<Lead | null> {
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
        orgName: orgProfiles.companyName,
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
    name: displayName(row.firstName, row.lastName, row.email ?? row.phone ?? anonymousLabel(row.channel)),
    company: row.company,
    email: row.email,
    phone: row.phone,
    channel: CHANNEL_LABEL[row.channel],
    fitScore: row.fitScore,
    scoreReasons: row.scoreReasons,
    link: appUrl ? `${appUrl}/conversations/${conversationId}` : null,
    timezone: row.timezone,
    status: row.status,
    orgName: row.orgName,
  };
}

/**
 * Mark a lead still being worked (new / active) as handed to a person. False
 * when it already was, or is booked / closed — so one lead never alerts twice.
 */
async function handToPerson(orgId: string, conversationId: string): Promise<boolean> {
  const updated = await withService((tx) =>
    tx
      .update(conversations)
      .set({ status: "handed_off", updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId), inArray(conversations.status, ["new", "active"])))
      .returning({ id: conversations.id }),
  );
  return updated.length > 0;
}

export async function notifyQualifiedLead(orgId: string, conversationId: string): Promise<void> {
  try {
    const lead = await loadLead(orgId, conversationId);
    if (lead) await notifyOrg(orgId, qualifiedLeadMessage(lead));
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
    await notifyOrg(orgId, meetingBookedMessage(lead, { when, joinUrl: meeting?.joinUrl ?? null }));
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
    if (!(await handToPerson(orgId, conversationId))) return false; // someone else got there first
    await notifyOrg(orgId, unansweredLeadMessage(lead, reason, after));
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}

/**
 * The agent had a qualified lead ready to book and the calendar failed (a slot
 * conflict is not this — the model offers another time). The lead is handed to
 * a person and the org is told what failed in the calendar's own words (Slack,
 * and the longer email with the places to fix it). Once per lead. Returns true
 * when it alerted.
 */
export async function notifyBookingFailed(orgId: string, conversationId: string, failure: BookingFailure): Promise<boolean> {
  try {
    const lead = await loadLead(orgId, conversationId);
    if (!lead || (lead.status !== "new" && lead.status !== "active")) return false;
    if (!(await handToPerson(orgId, conversationId))) return false;
    await notifyOrg(orgId, bookingFailedMessage(lead, failure), bookingFailedEmail(lead, failure, lead.orgName));
    return true;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}
