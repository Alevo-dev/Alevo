import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { consents, contacts, conversations, emailSuppressions, type Channel, type ConversationStatus, type Tx } from "@alevo/db";

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

export type ClientDetail = {
  contact: typeof contacts.$inferSelect;
  consents: Channel[];
  suppressed: string | null;
  conversations: ClientConversation[];
  capped: boolean;
};

const toNullableNumber = (v: unknown) => (v == null ? null : Number(v));
const toDate = (v: unknown) => new Date(v as string);

export async function clientDetail(tx: Tx, orgId: string, contactId: string): Promise<ClientDetail | null> {
  const [contact] = await tx.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId))).limit(1);
  if (!contact) return null;

  const mine = sql`c.conversation_id = ${conversations.id} and c.org_id = ${orgId}`;
  const [consentRows, suppression, convs] = await Promise.all([
    tx
      .select({ channel: consents.channel })
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
  ]);

  const seen = new Set<Channel>();
  for (const r of consentRows) seen.add(r.channel);
  return {
    contact,
    consents: (["form", "email", "sms", "chat", "voice"] as Channel[]).filter((c) => seen.has(c)),
    suppressed: suppression[0]?.reason ?? null,
    conversations: convs.slice(0, CLIENT_CONVERSATIONS_CAP),
    capped: convs.length > CLIENT_CONVERSATIONS_CAP,
  };
}
