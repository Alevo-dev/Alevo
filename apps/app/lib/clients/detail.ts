import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { calls, consents, contacts, conversations, emailSuppressions, meetings, psaLinks, type BookingProvider, type Channel, type ConversationStatus, type MeetingStatus, type Tx } from "@alevo/db";
import { CW_PROVIDER } from "@/lib/psa/connectwise-map";
import type { LinkedRecord } from "@/lib/psa/writeback";

/**
 * Everything the client page shows for one contact: who they are, what they have
 * consented to, whether their email is suppressed, and every conversation they
 * have had (newest first, capped). Org id explicit on every read.
 */

export const CLIENT_CONVERSATIONS_CAP = 100;

export type ClientConversation = {
  id: string;
  channel: Channel;
  status: ConversationStatus;
  fitScore: number | null;
  createdAt: Date;
  /** When the thread last moved: newest message or call, else the conversation's creation. */
  lastEntryAt: Date;
  /** First line of the newest message, or the call summary. */
  lastPreview: string | null;
  callDurationSec: number | null;
  callOutcome: string | null;
};

export type ClientCall = {
  id: string;
  conversationId: string | null;
  startedAt: Date;
  durationSec: number | null;
  outcome: string | null;
  summary: string | null;
  transcript: string | null;
  hasRecording: boolean;
};

export type ClientMeeting = {
  id: string;
  conversationId: string | null;
  provider: BookingProvider;
  status: MeetingStatus;
  outcome: "pending" | "showed" | "no_show";
  converted: boolean;
  startAt: Date | null;
  endAt: Date | null;
};

export type ClientDetail = {
  contact: typeof contacts.$inferSelect;
  consents: Channel[];
  /** Where each active consent came from (hosted_form, embed, api, …). */
  consentSources: Partial<Record<Channel, string>>;
  suppressed: string | null;
  conversations: ClientConversation[];
  capped: boolean;
  calls: ClientCall[];
  meetings: ClientMeeting[];
  /** What the PSA holds for this client (company, contact, activities, opportunity). */
  psa: LinkedRecord[];
};

const toNullableNumber = (v: unknown) => (v == null ? null : Number(v));
const toDate = (v: unknown) => new Date(v as string);

export async function clientDetail(tx: Tx, orgId: string, contactId: string): Promise<ClientDetail | null> {
  const [contact] = await tx.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId))).limit(1);
  if (!contact) return null;

  const mine = sql`c.conversation_id = ${conversations.id} and c.org_id = ${orgId}`;
  const [consentRows, suppression, convs, callRows, meetingRows] = await Promise.all([
    tx
      .select({ channel: consents.channel, source: consents.source })
      .from(consents)
      .where(and(eq(consents.contactId, contactId), eq(consents.orgId, orgId), isNull(consents.revokedAt))),
    contact.email
      ? tx
          .select({ reason: emailSuppressions.reason })
          .from(emailSuppressions)
          .where(and(eq(emailSuppressions.orgId, orgId), sql`lower(${emailSuppressions.email}) = ${contact.email.toLowerCase()}`))
          .limit(1)
      : Promise.resolve([]),
    tx
      .select({
        id: conversations.id,
        channel: conversations.channel,
        status: conversations.status,
        fitScore: conversations.fitScore,
        createdAt: conversations.createdAt,
        lastEntryAt: sql<Date>`greatest(${conversations.createdAt},
          coalesce((select max(c.created_at) from messages c where ${mine}), ${conversations.createdAt}),
          coalesce((select max(c.created_at) from calls c where ${mine}), ${conversations.createdAt}))`.mapWith(toDate),
        lastPreview: sql<string | null>`coalesce(
          (select left(c.body, 160) from messages c where ${mine} order by c.created_at desc limit 1),
          (select left(c.summary, 160) from calls c where ${mine} order by c.created_at desc limit 1))`,
        callDurationSec: sql<number | null>`(select c.duration_sec from calls c where ${mine} order by c.created_at desc limit 1)`.mapWith(toNullableNumber),
        callOutcome: sql<string | null>`(select c.outcome from calls c where ${mine} order by c.created_at desc limit 1)`,
      })
      .from(conversations)
      .where(and(eq(conversations.contactId, contactId), eq(conversations.orgId, orgId)))
      .orderBy(desc(conversations.createdAt), desc(conversations.id))
      .limit(CLIENT_CONVERSATIONS_CAP + 1),
    tx
      .select({
        id: calls.id,
        conversationId: calls.conversationId,
        startedAt: sql<Date>`coalesce(${calls.startedAt}, ${calls.createdAt})`.mapWith(toDate),
        durationSec: calls.durationSec,
        outcome: calls.outcome,
        summary: calls.summary,
        transcript: calls.transcript,
        recordingKey: calls.recordingKey,
      })
      .from(calls)
      .where(and(eq(calls.contactId, contactId), eq(calls.orgId, orgId)))
      .orderBy(desc(calls.createdAt))
      .limit(CLIENT_CONVERSATIONS_CAP),
    tx
      .select({ id: meetings.id, conversationId: meetings.conversationId, provider: meetings.provider, status: meetings.status, outcome: meetings.outcome, converted: meetings.converted, startAt: meetings.startAt, endAt: meetings.endAt })
      .from(meetings)
      .where(and(eq(meetings.contactId, contactId), eq(meetings.orgId, orgId)))
      .orderBy(desc(meetings.startAt))
      .limit(CLIENT_CONVERSATIONS_CAP),
  ]);
  const psa: LinkedRecord[] = await tx
    .select({ kind: psaLinks.kind, remoteId: psaLinks.remoteId, createdAt: psaLinks.createdAt })
    .from(psaLinks)
    .where(and(eq(psaLinks.orgId, orgId), eq(psaLinks.provider, CW_PROVIDER), inArray(psaLinks.localId, [contactId, ...convs.map((c) => c.id)])))
    .orderBy(psaLinks.createdAt);

  const seen = new Set<Channel>();
  const consentSources: Partial<Record<Channel, string>> = {};
  for (const r of consentRows) {
    seen.add(r.channel);
    if (r.source) consentSources[r.channel] = r.source;
  }
  return {
    contact,
    consents: (["form", "email", "sms", "chat", "voice"] as Channel[]).filter((c) => seen.has(c)),
    consentSources,
    suppressed: suppression[0]?.reason ?? null,
    conversations: convs.slice(0, CLIENT_CONVERSATIONS_CAP),
    capped: convs.length > CLIENT_CONVERSATIONS_CAP,
    calls: callRows.map(({ recordingKey, ...c }) => ({ ...c, hasRecording: Boolean(recordingKey) })),
    meetings: meetingRows,
    psa,
  };
}
