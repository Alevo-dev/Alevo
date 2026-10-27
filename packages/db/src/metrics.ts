import { sql } from "drizzle-orm";
import { calls } from "./schema/calls";
import { conversations } from "./schema/conversations";
import { meetings } from "./schema/meetings";
import { withService } from "./with-tenant";

/**
 * The north-star funnel per organization, over one window. Cross-tenant by
 * design (service path): the super-admin console lists every org, and the
 * internal speed-to-lead watch posts the slow ones. Tenant screens must NOT use
 * this; they read their own org through `withOrg`.
 */
export type OrgFunnel = {
  orgId: string;
  /** Conversations opened in the window. */
  leads: number;
  /** ...of which booked or handed to a person. */
  qualified: number;
  /** ...of which the agent answered (first reply recorded). */
  replied: number;
  /** Seconds from lead received to first reply, over answered leads. */
  p50: number | null;
  p95: number | null;
  /** Meetings created in the window that weren't cancelled. */
  meetings: number;
  /** Inbound calls answered in the window. */
  calls: number;
};

const toNumber = (v: unknown) => (v == null ? null : Number(v));
const count = sql<number>`count(*)`.mapWith(Number);

/**
 * Every org that had activity in the last `days` days, with its funnel numbers.
 * The clock is read in SQL (`now()`), so callers stay pure.
 */
export async function funnelByOrg(days: number): Promise<OrgFunnel[]> {
  const since = sql`now() - (${Math.max(1, Math.floor(days))}::int * interval '1 day')`;
  const replySeconds = sql`extract(epoch from (${conversations.firstReplySentAt} - ${conversations.leadReceivedAt}))`;

  const [convRows, meetingRows, callRows] = await Promise.all([
    withService((tx) =>
      tx
        .select({
          orgId: conversations.orgId,
          leads: count,
          qualified: sql<number>`count(*) filter (where ${conversations.status} in ('booked','handed_off'))`.mapWith(Number),
          replied: sql<number>`count(*) filter (where ${conversations.firstReplySentAt} is not null)`.mapWith(Number),
          p50: sql<number | null>`percentile_cont(0.5) within group (order by ${replySeconds})`.mapWith(toNumber),
          p95: sql<number | null>`percentile_cont(0.95) within group (order by ${replySeconds})`.mapWith(toNumber),
        })
        .from(conversations)
        .where(sql`${conversations.createdAt} >= ${since}`)
        .groupBy(conversations.orgId),
    ),
    withService((tx) =>
      tx
        .select({ orgId: meetings.orgId, n: count })
        .from(meetings)
        .where(sql`${meetings.createdAt} >= ${since} and ${meetings.status} <> 'cancelled'`)
        .groupBy(meetings.orgId),
    ),
    withService((tx) =>
      tx
        .select({ orgId: calls.orgId, n: count })
        .from(calls)
        .where(sql`coalesce(${calls.startedAt}, ${calls.createdAt}) >= ${since}`)
        .groupBy(calls.orgId),
    ),
  ]);

  const byOrg = new Map<string, OrgFunnel>();
  const row = (orgId: string): OrgFunnel => {
    let r = byOrg.get(orgId);
    if (!r) {
      r = { orgId, leads: 0, qualified: 0, replied: 0, p50: null, p95: null, meetings: 0, calls: 0 };
      byOrg.set(orgId, r);
    }
    return r;
  };
  for (const c of convRows) Object.assign(row(c.orgId), { leads: c.leads, qualified: c.qualified, replied: c.replied, p50: c.p50, p95: c.p95 });
  for (const m of meetingRows) row(m.orgId).meetings = m.n;
  for (const c of callRows) row(c.orgId).calls = c.n;
  return [...byOrg.values()];
}

export type FunnelBucket = { ago: number; leads: number; qualified: number; meetings: number; calls: number };

/**
 * The same funnel as `funnelByOrg`, summed across every org, per period:
 * one row per calendar day (UTC) for windows under 90 days, per week for 90
 * (`ago` = 0 is today / this week). Feeds the console's stat-tile mini bars.
 */
export async function funnelSeries(days: number): Promise<FunnelBucket[]> {
  const span = Math.max(1, Math.floor(days));
  const weekly = span >= 90;
  const cover = weekly ? Math.ceil(span / 7) * 7 : span;
  const since = sql`(current_date - ${cover - 1}::int)::timestamptz`;
  const ago = (col: unknown) =>
    weekly
      ? sql<number>`floor((current_date - (${col} at time zone 'UTC')::date) / 7)`.mapWith(Number)
      : sql<number>`(current_date - (${col} at time zone 'UTC')::date)`.mapWith(Number);

  const [convRows, meetingRows, callRows] = await Promise.all([
    withService((tx) =>
      tx
        .select({
          ago: ago(conversations.createdAt).as("ago"),
          leads: count,
          qualified: sql<number>`count(*) filter (where ${conversations.status} in ('booked','handed_off'))`.mapWith(Number),
        })
        .from(conversations)
        .where(sql`${conversations.createdAt} >= ${since}`)
        .groupBy(sql`ago`),
    ),
    withService((tx) =>
      tx
        .select({ ago: ago(meetings.createdAt).as("ago"), n: count })
        .from(meetings)
        .where(sql`${meetings.createdAt} >= ${since} and ${meetings.status} <> 'cancelled'`)
        .groupBy(sql`ago`),
    ),
    withService((tx) =>
      tx
        .select({ ago: ago(sql`coalesce(${calls.startedAt}, ${calls.createdAt})`).as("ago"), n: count })
        .from(calls)
        .where(sql`coalesce(${calls.startedAt}, ${calls.createdAt}) >= ${since}`)
        .groupBy(sql`ago`),
    ),
  ]);

  const byAgo = new Map<number, FunnelBucket>();
  const row = (ago: number): FunnelBucket => {
    let r = byAgo.get(ago);
    if (!r) {
      r = { ago, leads: 0, qualified: 0, meetings: 0, calls: 0 };
      byAgo.set(ago, r);
    }
    return r;
  };
  for (const c of convRows) Object.assign(row(c.ago), { leads: c.leads, qualified: c.qualified });
  for (const m of meetingRows) row(m.ago).meetings = m.n;
  for (const c of callRows) row(c.ago).calls = c.n;
  return [...byAgo.values()];
}
