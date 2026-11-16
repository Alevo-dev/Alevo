import { and, count, desc, eq, sql } from "drizzle-orm";
import { contacts, conversations, type Channel, type ConversationStatus, type Tx } from "@alevo/db";
import { bucketCount, type Window } from "@/lib/dashboard/window";
import { windowSql } from "@/lib/dashboard/window-sql";
import { toSeries } from "@/app/(app)/dashboard/kpi-tiles";

/**
 * What the Conversations screen shows above the list for one time window: the
 * four key figures (new clients, conversations, booked, handed off) with their
 * series and the period before, the clients-per-bucket series, where the window's
 * new clients ended up, and the facts for the info strip. Org id explicit on
 * every read (platform admins bypass RLS).
 */
export type ClientOverview = {
  series: { clients: number[]; conversations: number[]; booked: number[]; handed: number[] };
  prior: { clients: number; conversations: number; booked: number; handed: number };
  endsUp: { status: ConversationStatus | "none"; n: number }[];
  openNow: number;
  busiest: Channel | null;
  lastActivity: Date | null;
  /** The org's calendar today (YYYY-MM-DD), for axis labels. */
  today: string;
};

const toDate = (v: unknown) => (v == null ? null : new Date(v as string));

export async function clientOverview(tx: Tx, orgId: string, days: Window, tz: string): Promise<ClientOverview> {
  const { today, windowStart, priorStart, ago } = windowSql(days, tz);
  const n = bucketCount(days);
  const count_ = sql<number>`count(*)`.mapWith(Number);
  const latest = sql<ConversationStatus | null>`(select c.status::text from conversations c where c.contact_id = ${contacts.id} and c.org_id = ${orgId} order by c.updated_at desc, c.id desc limit 1)`;

  const [clientsDaily, convDaily, [prior], [priorClients], endsUp, [open], busiest, [last], [clock]] = await Promise.all([
    tx
      .select({ ago: ago(contacts.createdAt).as("ago"), n: count_ })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), sql`${contacts.createdAt} >= ${windowStart}`))
      .groupBy(sql`ago`),
    tx
      .select({
        ago: ago(conversations.createdAt).as("ago"),
        n: count_,
        booked: sql<number>`count(*) filter (where ${conversations.status} = 'booked')`.mapWith(Number),
        handed: sql<number>`count(*) filter (where ${conversations.status} = 'handed_off')`.mapWith(Number),
      })
      .from(conversations)
      .where(and(eq(conversations.orgId, orgId), sql`${conversations.createdAt} >= ${windowStart}`))
      .groupBy(sql`ago`),
    tx
      .select({
        n: count_,
        booked: sql<number>`count(*) filter (where ${conversations.status} = 'booked')`.mapWith(Number),
        handed: sql<number>`count(*) filter (where ${conversations.status} = 'handed_off')`.mapWith(Number),
      })
      .from(conversations)
      .where(and(eq(conversations.orgId, orgId), sql`${conversations.createdAt} >= ${priorStart}`, sql`${conversations.createdAt} < ${windowStart}`)),
    tx
      .select({ n: count_ })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), sql`${contacts.createdAt} >= ${priorStart}`, sql`${contacts.createdAt} < ${windowStart}`)),
    tx
      .select({ status: latest.as("status"), n: count_ })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), sql`${contacts.createdAt} >= ${windowStart}`))
      .groupBy(sql`status`),
    tx
      .select({ n: count_ })
      .from(conversations)
      .where(and(eq(conversations.orgId, orgId), sql`${conversations.status} in ('new','active')`)),
    tx
      .select({ channel: conversations.channel, n: count_ })
      .from(conversations)
      .where(and(eq(conversations.orgId, orgId), sql`${conversations.createdAt} >= ${windowStart}`))
      .groupBy(conversations.channel)
      .orderBy(desc(sql`count(*)`))
      .limit(1),
    tx
      .select({ at: sql<Date | null>`max(${contacts.lastActivityAt})`.mapWith(toDate) })
      .from(contacts)
      .where(eq(contacts.orgId, orgId)),
    tx.select({ today: sql<string>`${today}::text` }).from(sql`(select 1) as t`),
  ]);

  return {
    series: {
      clients: toSeries(clientsDaily, n),
      conversations: toSeries(convDaily, n),
      booked: toSeries(convDaily.map((r) => ({ ago: r.ago, n: r.booked })), n),
      handed: toSeries(convDaily.map((r) => ({ ago: r.ago, n: r.handed })), n),
    },
    prior: { clients: priorClients?.n ?? 0, conversations: prior?.n ?? 0, booked: prior?.booked ?? 0, handed: prior?.handed ?? 0 },
    endsUp: endsUp.map((r) => ({ status: r.status ?? "none", n: r.n })),
    openNow: open?.n ?? 0,
    busiest: busiest[0]?.channel ?? null,
    lastActivity: last?.at ?? null,
    today: clock?.today ?? new Date().toISOString().slice(0, 10),
  };
}
