import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { calls, contacts, conversations, countsTowardSpeed, isReady, loadReadinessFacts, meetings, orgSubscriptions, plans, readiness } from "@alevo/db";
import { getCurrentOrg, getCurrentRole, withOrg } from "@alevo/auth";
import { getAgentOn } from "@/lib/agent-on";
import { ChannelIcons, deltaOf, FitMeter, Kpi, Panel, Strip } from "@/components/conversations/kit";
import { RefreshButton } from "@/components/conversations/refresh-button";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Pill, StatusDot } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { readWindow } from "@/lib/dashboard/window-pref";
import { bucketCount, bucketFor, bucketLabels, bucketShortLabels, coverDays, fmtDuration, parseWindow, priorLabel, showRatePct, windowLabel, windowRange } from "@/lib/dashboard/window";
import { anonymousLabel, displayName, fmtShort } from "@/lib/format";
import { windowSql } from "@/lib/dashboard/window-sql";
import { getOrgTimezone } from "@/lib/org-timezone";
import { getCurrentUsage } from "@/lib/usage/current";
import { CONVERSATION_STATUS } from "@/lib/ui/status";
import { AutoRefresh } from "./auto-refresh";
import { ChannelDonut } from "./channel-donut";
import { GettingStarted } from "./getting-started";
import { toSeries } from "./kpi-tiles";
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
  const days = await readWindow();
  const bucket = bucketFor(days);
  const buckets = bucketCount(days);
  const per = `per ${bucket}`;
  const span = windowLabel(days);

  // Calendar days in the org's timezone, so bars line up with what the user calls a day.
  const tz = await getOrgTimezone();
  const { today, windowStart, priorStart, ago } = windowSql(days, tz);
  // Explicit active-org scope on every read (platform admins bypass RLS).
  const inOrg = (col: typeof conversations.orgId | typeof meetings.orgId | typeof calls.orgId) =>
    sql`${col} = (select app.current_org_id())`;
  const count = sql<number>`count(*)`.mapWith(Number);
  const replySeconds = sql`extract(epoch from (${conversations.firstReplySentAt} - ${conversations.leadReceivedAt}))`;
  const answered = and(
    inOrg(conversations.orgId),
    sql`${conversations.firstReplySentAt} is not null`,
    // Leads the agent could not work (off, paused, unsubscribed) are not its wait.
    countsTowardSpeed,
    sql`${conversations.createdAt} >= ${windowStart}`,
  );

  // Owners and admins see the Getting started checklist until the workspace is ready.
  const [org, role] = await Promise.all([getCurrentOrg(), getCurrentRole()]);
  const showSetup = org && (role === "admin" || role === "owner");

  const [facts, [clock], convDaily, meetingDaily, [outcomes], byChannel, [speed], speedDaily, recent, usage, agentOn, [skipped], [failed], [prior], [priorMeetings], [open], [sub]] =
    await Promise.all([
      showSetup ? loadReadinessFacts(org.id) : null,
      withOrg((tx) => tx.select({ today: sql<string>`${today}::text` }).from(sql`(select 1) as t`)),
      withOrg((tx) =>
        tx
          .select({
            ago: ago(conversations.createdAt).as("ago"),
            leads: count,
            qualified: sql<number>`count(*) filter (where ${conversations.status} in ('booked','handed_off'))`.mapWith(Number),
            handed: sql<number>`count(*) filter (where ${conversations.status} = 'handed_off')`.mapWith(Number),
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
      // Show rate: meetings that took place in the window and have an outcome marked.
      withOrg((tx) =>
        tx
          .select({
            showed: sql<number>`count(*) filter (where ${meetings.outcome} = 'showed')`.mapWith(Number),
            noShow: sql<number>`count(*) filter (where ${meetings.outcome} = 'no_show')`.mapWith(Number),
            held: count,
          })
          .from(meetings)
          .where(and(inOrg(meetings.orgId), sql`${meetings.startAt} >= ${windowStart}`, sql`${meetings.outcome} <> 'pending'`)),
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
            phone: contacts.phone,
          })
          .from(conversations)
          .innerJoin(contacts, eq(contacts.id, conversations.contactId))
          .where(inOrg(conversations.orgId))
          .orderBy(desc(conversations.createdAt))
          .limit(7),
      ),
      getCurrentUsage(),
      getAgentOn(),
      // Leads left out of speed to lead: the agent could not work them.
      withOrg((tx) =>
        tx
          .select({ n: count })
          .from(conversations)
          .where(and(inOrg(conversations.orgId), sql`${conversations.agentSkipped} is not null`, sql`${conversations.createdAt} >= ${windowStart}`)),
      ),
      // Replies the agent wrote that never reached the contact; cleared when a later one does.
      withOrg((tx) =>
        tx
          .select({ n: count })
          .from(conversations)
          .where(and(inOrg(conversations.orgId), sql`${conversations.replyFailedAt} is not null`)),
      ),
      // The period before this window, for each tile's "vs prior" line.
      withOrg((tx) =>
        tx
          .select({
            leads: count,
            qualified: sql<number>`count(*) filter (where ${conversations.status} in ('booked','handed_off'))`.mapWith(Number),
            handed: sql<number>`count(*) filter (where ${conversations.status} = 'handed_off')`.mapWith(Number),
          })
          .from(conversations)
          .where(and(inOrg(conversations.orgId), sql`${conversations.createdAt} >= ${priorStart}`, sql`${conversations.createdAt} < ${windowStart}`)),
      ),
      withOrg((tx) =>
        tx
          .select({ n: count })
          .from(meetings)
          .where(and(inOrg(meetings.orgId), sql`${meetings.createdAt} >= ${priorStart}`, sql`${meetings.createdAt} < ${windowStart}`, sql`${meetings.status} <> 'cancelled'`)),
      ),
      withOrg((tx) =>
        tx
          .select({ n: count })
          .from(conversations)
          .where(and(inOrg(conversations.orgId), sql`${conversations.status} in ('new','active')`)),
      ),
      withOrg((tx) =>
        tx
          .select({ name: plans.name })
          .from(orgSubscriptions)
          .innerJoin(plans, eq(plans.id, orgSubscriptions.planId))
          .where(sql`${orgSubscriptions.orgId} = (select app.current_org_id())`)
          .limit(1),
      ),
    ]);

  const series = {
    leads: toSeries(convDaily.map((r) => ({ ago: r.ago, n: r.leads })), buckets),
    qualified: toSeries(convDaily.map((r) => ({ ago: r.ago, n: r.qualified })), buckets),
    meetings: toSeries(meetingDaily, buckets),
    handed: toSeries(convDaily.map((r) => ({ ago: r.ago, n: r.handed })), buckets),
  };
  const showRate = showRatePct(outcomes?.showed ?? 0, outcomes?.held ?? 0);
  const todayIso = clock?.today ?? new Date().toISOString().slice(0, 10);
  const labels = bucketLabels(todayIso, days);
  const shorts = bucketShortLabels(todayIso, days);
  const points = (s: number[]) => s.map((n, i) => ({ label: labels[i] ?? "", short: shorts[i] ?? "", n }));
  // Median reply per bucket, oldest first; null where nothing was answered.
  const medianByAgo = new Map(speedDaily.map((r) => [r.ago, r.median]));
  const speedTrend = labels.map((label, i) => ({ label, seconds: medianByAgo.get(buckets - 1 - i) ?? null }));
  const setup = facts ? readiness(facts) : null;
  const checklist = setup && !isReady(setup) ? setup : null;

  const vs = priorLabel(days);
  const sum = (v: number[]) => v.reduce((x, y) => x + y, 0);
  const totals = { leads: sum(series.leads), qualified: sum(series.qualified), meetings: sum(series.meetings), handed: sum(series.handed) };
  const showed = outcomes?.showed ?? 0;
  const noShow = outcomes?.noShow ?? 0;

  return (
    <div className="flex flex-col gap-3.5">
      <AutoRefresh />
      <PageHeader title="Dashboard">
        <WindowSwitch value={days} />
        <RefreshButton />
        {!agentOn && (
          <Link href="/workspace/agent" className={buttonClass("primary", "sm")}>
            Turn the agent on
          </Link>
        )}
      </PageHeader>

      <Strip
        items={[
          { k: "Agent", v: <Pill tone={agentOn ? "success" : "muted"}>{agentOn ? "Online" : "Off"}</Pill> },
          { k: "Open leads", v: <span className="tabular">{open?.n ?? 0}</span> },
          { k: "Median reply", v: <span className="tabular font-mono">{speed?.p50 == null ? "—" : fmtDuration(speed.p50)}</span> },
          { k: "Window", v: windowRange(todayIso, days) },
          { k: "Timezone", v: tz },
          { k: "Plan", v: sub?.name ?? "None" },
        ]}
      />

      {(failed?.n ?? 0) > 0 && (
        <Notice tone="danger">
          The agent could not complete a reply to {failed!.n} {failed!.n === 1 ? "lead" : "leads"} (a send failed or it hit an error). Open{" "}
          <Link href="/conversations">conversations</Link> and reach out yourself; each notice clears once a reply goes through.
        </Notice>
      )}

      {checklist && <GettingStarted items={checklist} />}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key figures">
        <Kpi label="Leads" value={totals.leads} delta={deltaOf(totals.leads, prior?.leads ?? 0, vs)} series={series.leads} seriesLabels={labels} unit="leads" period={bucket} tone="brand" />
        <Kpi label="Qualified" value={totals.qualified} delta={deltaOf(totals.qualified, prior?.qualified ?? 0, vs)} series={series.qualified} seriesLabels={labels} unit="qualified" period={bucket} tone="violet" />
        <Kpi label="Meetings booked" value={totals.meetings} delta={deltaOf(totals.meetings, priorMeetings?.n ?? 0, vs)} series={series.meetings} seriesLabels={labels} unit="meetings" period={bucket} tone="success" />
        <Kpi label="Handed to a person" value={totals.handed} delta={deltaOf(totals.handed, prior?.handed ?? 0, vs)} series={series.handed} seriesLabels={labels} unit="handed off" period={bucket} tone="warning" />
      </section>

      <section className="grid gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" aria-label="Leads and response time">
        <Card boxed>
          <CardHeader title={`Leads ${per}`} hint={span} />
          <TrendChart points={points(series.leads)} unit="leads" kind="area" tone="brand" />
        </Card>
        <SpeedCard p50={speed?.p50 ?? null} p95={speed?.p95 ?? null} replied={speed?.replied ?? 0} excluded={skipped?.n ?? 0} />
      </section>

      <section className="grid gap-3.5 lg:grid-cols-3" aria-label="Meetings, sources and usage">
        <Card boxed padding="none">
          <CardHeader
            title="Meetings booked"
            hint={`${per[0]!.toUpperCase()}${per.slice(1)}`}
            aside={
              showRate != null ? (
                <>
                  Show rate <strong className="tabular font-semibold text-ink">{showRate}%</strong>
                  <span className="sr-only">, {showed} of {outcomes?.held ?? 0} meetings held</span>
                </>
              ) : (
                <>
                  Show rate: <Link href="/meetings">mark outcomes</Link>
                </>
              )
            }
          />
          <div className="p-3.5">
            <TrendChart points={points(series.meetings)} unit="meetings" kind="columns" tone="violet" width={400} />
          </div>
          <div className="flex items-center gap-2 border-t border-hairline bg-sunken px-3.5 py-[7px] text-[13px] text-ink-muted">
            <span>
              Showed {showed} · No-show {noShow}
            </span>
          </div>
        </Card>
        <Card boxed>
          <CardHeader title="Where leads come from" hint={span} />
          {byChannel.length === 0 ? (
            <p className="text-sm text-ink-muted">No new leads in this window.</p>
          ) : (
            <ChannelDonut rows={byChannel} />
          )}
        </Card>
        <UsageMeter rows={usage} plan={sub?.name ?? null} month={todayIso} />
      </section>

      <Panel
        title="Live activity"
        hint="Refreshes every 30 seconds"
        right={
          <span className="inline-flex h-[22px] items-center gap-2 rounded-full border border-success/55 bg-success/10 px-2.5 text-[12.5px] font-[550] text-success">
            <StatusDot tone="success" live />
            Live
          </span>
        }
        flush
        footer={
          recent.length > 0 && (
            <>
              <span>Showing the latest {recent.length}</span>
              <Link href="/conversations" className="ml-auto">
                View all conversations
              </Link>
            </>
          )
        }
      >
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Client</Th>
              <Th>Channel</Th>
              <Th>Status</Th>
              <Th className="text-right">Fit</Th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <EmptyRow colSpan={5}>
                No leads yet. Share your hosted lead form, or send a test message from a conversation, and activity shows up here.
                {org && (
                  <>
                    {" "}
                    <Link href={`/form/${org.id}`}>Open your lead form</Link>
                  </>
                )}
              </EmptyRow>
            ) : (
              recent.map((c, i) => {
                const status = CONVERSATION_STATUS[c.status];
                const name = displayName(c.firstName, c.lastName, c.email ?? c.phone ?? anonymousLabel(c.channel) ?? "New lead");
                return (
                  <Tr key={c.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-rise">
                    <Td className="tabular whitespace-nowrap font-mono text-[12px] text-ink-muted">{fmtShort(c.createdAt, tz)}</Td>
                    <Td>
                      <Link href={`/conversations/${c.id}`} transitionTypes={["nav-forward"]} className="font-semibold text-ink no-underline hover:underline">
                        {name}
                      </Link>
                      <span className="block text-[12.5px] text-ink-muted">{c.company ?? " "}</span>
                    </Td>
                    <Td>
                      <ChannelIcons channels={[c.channel]} />
                    </Td>
                    <Td>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </Td>
                    <Td className="text-right">
                      <FitMeter score={c.fitScore} />
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
