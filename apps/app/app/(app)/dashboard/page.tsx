import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql, type SQLWrapper } from "drizzle-orm";
import { calls, contacts, conversations, meetings } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { getAgentOn } from "@/lib/agent-on";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pill, StatusDot } from "@/components/ui/pill";
import { bucketCount, bucketFor, bucketLabels, bucketShortLabels, coverDays, parseWindow } from "@/lib/dashboard/window";
import { displayName, fmtShort } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { getCurrentUsage } from "@/lib/usage/current";
import { CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";
import { AutoRefresh } from "./auto-refresh";
import { ChannelDonut } from "./channel-donut";
import { KpiTiles, toSeries } from "./kpi-tiles";
import { SpeedCard } from "./speed-card";
import { TrendChart } from "./trend-chart";
import { UsageMeter } from "./usage-meter";
import { WindowSwitch } from "./window-switch";

// Reads the session + DB, so it must render per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

const toNumber = (v: unknown) => (v == null ? null : Number(v));

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const [{ orgId }, search] = await Promise.all([auth(), searchParams]);

  // Signed in but no active org yet — prompt them to create/select one.
  if (!orgId) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-heading font-semibold">Create your organization</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Use the organization switcher in the sidebar to create your workspace.
        </p>
      </Card>
    );
  }

  // One window for the whole page (?window=7|30|90). 7 and 30 days bucket per
  // day, 90 per week; the usage meter alone is always the billing month.
  const days = parseWindow(search.window);
  const bucket = bucketFor(days);
  const buckets = bucketCount(days);
  const per = bucket === "day" ? "per day" : "per week";

  // Calendar days in the org's timezone, so bars line up with what the user calls
  // a day. Computed in SQL so the render stays pure (no clock reads).
  const tz = await getOrgTimezone();
  const today = sql`(now() at time zone ${tz})::date`;
  const windowStart = sql`(${today} - ${coverDays(days) - 1}::int)::timestamp at time zone ${tz}`;
  // Whole buckets ago (0 = today / this week) for a timestamptz column.
  const ago = (col: SQLWrapper) =>
    bucket === "day"
      ? sql<number>`(${today} - (${col} at time zone ${tz})::date)`.mapWith(Number)
      : sql<number>`floor((${today} - (${col} at time zone ${tz})::date) / 7)`.mapWith(Number);
  // Explicit active-org scope on every read (platform admins bypass RLS).
  const inOrg = (col: typeof conversations.orgId | typeof meetings.orgId | typeof calls.orgId) =>
    sql`${col} = (select app.current_org_id())`;
  const count = sql<number>`count(*)`.mapWith(Number);
  const replySeconds = sql`extract(epoch from (${conversations.firstReplySentAt} - ${conversations.leadReceivedAt}))`;
  const answered = and(
    inOrg(conversations.orgId),
    sql`${conversations.firstReplySentAt} is not null`,
    sql`${conversations.createdAt} >= ${windowStart}`,
  );

  const [org, [clock], convDaily, meetingDaily, callDaily, byChannel, [speed], speedDaily, recent, usage, agentOn] =
    await Promise.all([
      getCurrentOrg(),
      withOrg((tx) => tx.select({ today: sql<string>`${today}::text` }).from(sql`(select 1) as t`)),
      withOrg((tx) =>
        tx
          .select({
            ago: ago(conversations.createdAt).as("ago"),
            leads: count,
            qualified: sql<number>`count(*) filter (where ${conversations.status} in ('booked','handed_off'))`.mapWith(Number),
          })
          .from(conversations)
          .where(and(inOrg(conversations.orgId), sql`${conversations.createdAt} >= ${windowStart}`))
          .groupBy(sql`ago`),
      ),
      withOrg((tx) =>
        tx
          .select({ ago: ago(meetings.createdAt).as("ago"), n: count })
          .from(meetings)
          .where(and(inOrg(meetings.orgId), sql`${meetings.createdAt} >= ${windowStart}`, sql`${meetings.status} <> 'cancelled'`))
          .groupBy(sql`ago`),
      ),
      withOrg((tx) =>
        tx
          .select({ ago: ago(sql`coalesce(${calls.startedAt}, ${calls.createdAt})`).as("ago"), n: count })
          .from(calls)
          .where(and(inOrg(calls.orgId), sql`coalesce(${calls.startedAt}, ${calls.createdAt}) >= ${windowStart}`))
          .groupBy(sql`ago`),
      ),
      withOrg((tx) =>
        tx
          .select({ channel: conversations.channel, n: count })
          .from(conversations)
          .where(and(inOrg(conversations.orgId), sql`${conversations.createdAt} >= ${windowStart}`))
          .groupBy(conversations.channel)
          .orderBy(desc(sql`count(*)`)),
      ),
      // Speed to lead over the window: first reply minus lead received, answered leads only.
      withOrg((tx) =>
        tx
          .select({
            p50: sql<number | null>`percentile_cont(0.5) within group (order by ${replySeconds})`.mapWith(toNumber),
            p95: sql<number | null>`percentile_cont(0.95) within group (order by ${replySeconds})`.mapWith(toNumber),
            replied: count,
          })
          .from(conversations)
          .where(answered),
      ),
      // ...and the median per bucket for the sparkline.
      withOrg((tx) =>
        tx
          .select({
            ago: ago(conversations.createdAt).as("ago"),
            median: sql<number | null>`percentile_cont(0.5) within group (order by ${replySeconds})`.mapWith(toNumber),
          })
          .from(conversations)
          .where(answered)
          .groupBy(sql`ago`),
      ),
      withOrg((tx) =>
        tx
          .select({
            id: conversations.id,
            status: conversations.status,
            channel: conversations.channel,
            fitScore: conversations.fitScore,
            createdAt: conversations.createdAt,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            email: contacts.email,
            company: contacts.company,
          })
          .from(conversations)
          .innerJoin(contacts, eq(contacts.id, conversations.contactId))
          .where(inOrg(conversations.orgId))
          .orderBy(desc(conversations.createdAt))
          .limit(8),
      ),
      getCurrentUsage(),
      getAgentOn(),
    ]);

  const series = {
    leads: toSeries(convDaily.map((r) => ({ ago: r.ago, n: r.leads })), buckets),
    qualified: toSeries(convDaily.map((r) => ({ ago: r.ago, n: r.qualified })), buckets),
    meetings: toSeries(meetingDaily, buckets),
    calls: toSeries(callDaily, buckets),
  };
  const todayIso = clock?.today ?? new Date().toISOString().slice(0, 10);
  const labels = bucketLabels(todayIso, days);
  const shorts = bucketShortLabels(todayIso, days);
  const points = (s: number[]) => s.map((n, i) => ({ label: labels[i] ?? "", short: shorts[i] ?? "", n }));
  // Median reply per bucket, oldest first; null where nothing was answered.
  const medianByAgo = new Map(speedDaily.map((r) => [r.ago, r.median]));
  const speedTrend = labels.map((label, i) => ({ label, seconds: medianByAgo.get(buckets - 1 - i) ?? null }));

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeader
        title="Dashboard"
        description={
          <>
            <StatusDot tone={agentOn ? "success" : "muted"} live={agentOn} />
            {agentOn ? "Live." : "The agent is off."} {org?.name ?? "Your workspace"}, last {days} days
          </>
        }
      >
        <WindowSwitch value={days} />
        {!agentOn && (
          <Link href="/workspace/agent" className={buttonClass("primary")}>
            Turn the agent on
          </Link>
        )}
      </PageHeader>

      <KpiTiles days={days} {...series} />

      {/* Row 1 (mockup): leads area chart, 2/3; speed to lead, 1/3. */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" aria-label="Leads and response time">
        <Card>
          <CardHeader title={`Leads ${per}`} hint={`Last ${days} days`} />
          <TrendChart points={points(series.leads)} unit="leads" kind="area" tone="brand" />
        </Card>
        <SpeedCard p50={speed?.p50 ?? null} p95={speed?.p95 ?? null} replied={speed?.replied ?? 0} trend={speedTrend} per={per} />
      </section>

      {/* Row 2 (mockup): meetings columns, lead sources, plan usage. */}
      <section className="grid gap-6 lg:grid-cols-3" aria-label="Meetings, sources and usage">
        <Card>
          <CardHeader title="Meetings booked" hint={`${per[0]!.toUpperCase()}${per.slice(1)}, last ${days} days`} />
          <TrendChart points={points(series.meetings)} unit="meetings" kind="columns" tone="brand" width={400} />
        </Card>
        <Card>
          <CardHeader title="Where leads come from" hint={`Last ${days} days`} />
          {byChannel.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">No new leads in this window.</p>
          ) : (
            <ChannelDonut rows={byChannel} />
          )}
        </Card>
        <UsageMeter rows={usage} />
      </section>

      {/* Row 3 (mockup): the live feed, full width. */}
      <Card>
        <CardHeader
          title="Live activity"
          aside={
            <span className="flex items-center gap-2 text-label text-ink-muted">
              <StatusDot tone="success" live />
              Updating
            </span>
          }
        />
        {recent.length === 0 ? (
          <div className="mt-2">
            <p className="text-sm text-ink-muted">
              No leads yet. Share your hosted lead form, or send a test message from a conversation, and activity shows up here.
            </p>
            {org && (
              <Link href={`/f/${org.id}`} className={buttonClass("secondary", "md", "mt-4")}>
                Open your lead form
              </Link>
            )}
          </div>
        ) : (
          <ol className="mt-2 divide-y divide-hairline">
            {recent.map((c, i) => {
              const status = CONVERSATION_STATUS[c.status];
              return (
                <li
                  key={c.id}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-rise grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[132px_minmax(0,1fr)_auto]"
                >
                  <span className="tabular font-mono text-label text-ink-muted">{fmtShort(c.createdAt, tz)}</span>
                  <span className="min-w-0 truncate text-sm">
                    <Link
                      href={`/conversations/${c.id}`}
                      transitionTypes={["nav-forward"]}
                      className="font-medium text-ink no-underline hover:underline"
                    >
                      {displayName(c.firstName, c.lastName, c.email)}
                    </Link>
                    <span className="text-ink-muted">
                      {c.company ? `, ${c.company}` : ""}, {CHANNEL_LABEL[c.channel]}
                      {c.fitScore != null ? `, score ${c.fitScore}` : ""}
                    </span>
                  </span>
                  <span className="col-start-2 sm:col-start-3">
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {recent.length > 0 && (
          <p className="mt-3 text-right text-label">
            <Link href="/conversations">All conversations</Link>
          </p>
        )}
      </Card>
    </div>
  );
}
