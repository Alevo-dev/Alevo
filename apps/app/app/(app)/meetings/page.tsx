import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { contacts, finishPage, keysetOrder, keysetWhere, listOrgSecretKeys, meetings, memberships, orgProfiles, PAGE_SIZE, pageCount, parseCursor, users } from "@alevo/db";
import { getCurrentOrg, getCurrentRole, withOrg } from "@alevo/auth";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cursorHref, Pager } from "@/components/ui/pager";
import { Pill } from "@/components/ui/pill";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { bookingSnapshot, connectedBookingTools, isBookingTool } from "@/lib/booking/connected";
import { readWindow } from "@/lib/dashboard/window-pref";
import { bucketCount, bucketFor, bucketLabels, bucketShortLabels, coverDays, showRatePct } from "@/lib/dashboard/window";
import { displayName, fmtDateTime, fmtShort, tzLabel } from "@/lib/format";
import { deltaView, priorLabel, type Good } from "@/lib/meetings/figures";
import { repOptions, tallyReps } from "@/lib/meetings/reps";
import { getOrgTimezone } from "@/lib/org-timezone";
import { MEETING_STATUS, PROVIDER_LABEL } from "@/lib/ui/status";
import { Donut } from "../dashboard/channel-donut";
import { toSeries } from "../dashboard/kpi-tiles";
import { TrendChart } from "../dashboard/trend-chart";
import { WindowSwitch } from "../dashboard/window-switch";
import { ManageControls, OutcomeControls, RepControl } from "./meetings-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meetings" };

// Explicit active-org scope on every read: platform admins bypass RLS.
const ORG = sql`${meetings.orgId} = (select app.current_org_id())`;
// Latest start first; a meeting not yet scheduled sorts by when it was created.
const KEY = { at: sql`coalesce(${meetings.startAt}, ${meetings.createdAt})`, id: meetings.id };
const countWhere = (cond: SQL) => sql<number>`count(*) filter (where ${cond})`.mapWith(Number);
const sum = (xs: number[]) => xs.reduce((a, n) => a + n, 0);

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ cursor?: string; window?: string }> }) {
  const search = await searchParams;
  const cursor = parseCursor(search.cursor);
  // One window for the figures and the chart (the app-wide "Last:" choice); the list below is every meeting.
  const days = await readWindow();
  const bucket = bucketFor(days);
  const buckets = bucketCount(days);

  const [org, tz] = await Promise.all([getCurrentOrg(), getOrgTimezone()]);
  // Calendar days in the org's timezone, so bars line up with what people call a day.
  const today = sql`(now() at time zone ${tz})::date`;
  const windowStart = sql`(${today} - ${coverDays(days) - 1}::int)::timestamp at time zone ${tz}`;
  const priorStart = sql`(${today} - ${2 * coverDays(days) - 1}::int)::timestamp at time zone ${tz}`;
  // Whole buckets ago (0 = today / this week); today's hours count back from the last bar.
  const ago = (col: SQLWrapper) =>
    bucket === "hour"
      ? sql<number>`(23 - extract(hour from (${col} at time zone ${tz}))::int)`.mapWith(Number)
      : bucket === "day"
        ? sql<number>`(${today} - (${col} at time zone ${tz})::date)`.mapWith(Number)
        : sql<number>`floor((${today} - (${col} at time zone ${tz})::date) / 7)`.mapWith(Number);
  const held = sql`coalesce(${meetings.startAt}, ${meetings.createdAt})`;
  const noShow = sql`(${meetings.outcome} = 'no_show' or ${meetings.status} = 'no_show')`;
  const inPrior = sql`${held} >= ${priorStart} and ${held} < ${windowStart}`;

  // Everything below is independent: one round trip.
  const [[clock], total, bookedDaily, heldDaily, [prior], [next], [profile], secretKeys, fetched, role, members, byRep] = await Promise.all([
    withOrg((tx) => tx.select({ today: sql<string>`${today}::text` }).from(sql`(select 1) as t`)),
    withOrg((tx) => tx.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(meetings).where(ORG)),
    // Booked: made in the window (as the dashboard counts them), not cancelled.
    withOrg((tx) =>
      tx
        .select({ ago: ago(meetings.createdAt).as("ago"), n: sql<number>`count(*)`.mapWith(Number) })
        .from(meetings)
        .where(and(ORG, sql`${meetings.createdAt} >= ${windowStart} and ${meetings.status} <> 'cancelled'`))
        .groupBy(sql`ago`),
    ),
    // Showed / no-shows / converted, by when the meeting was held.
    withOrg((tx) =>
      tx
        .select({
          ago: ago(held).as("ago"),
          showed: countWhere(sql`${meetings.outcome} = 'showed'`),
          noShows: countWhere(noShow),
          converted: countWhere(sql`${meetings.converted}`),
          marked: countWhere(sql`${meetings.outcome} <> 'pending'`),
        })
        .from(meetings)
        .where(and(ORG, sql`${held} >= ${windowStart}`))
        .groupBy(sql`ago`),
    ),
    // The window before, for "vs prior 30 days".
    withOrg((tx) =>
      tx
        .select({
          booked: countWhere(sql`${meetings.createdAt} >= ${priorStart} and ${meetings.createdAt} < ${windowStart} and ${meetings.status} <> 'cancelled'`),
          showed: countWhere(sql`${inPrior} and ${meetings.outcome} = 'showed'`),
          noShows: countWhere(sql`${inPrior} and ${noShow}`),
          converted: countWhere(sql`${inPrior} and ${meetings.converted}`),
        })
        .from(meetings)
        .where(ORG),
    ),
    withOrg((tx) =>
      tx
        .select({ startAt: meetings.startAt, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email })
        .from(meetings)
        .leftJoin(contacts, eq(contacts.id, meetings.contactId))
        .where(and(ORG, sql`${meetings.startAt} > now() and ${meetings.status} <> 'cancelled'`))
        .orderBy(meetings.startAt)
        .limit(1),
    ),
    org ? withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)) : Promise.resolve([]),
    org ? listOrgSecretKeys(org.id) : Promise.resolve([] as string[]),
    withOrg((tx) =>
      tx
        .select({
          id: meetings.id,
          status: meetings.status,
          outcome: meetings.outcome,
          converted: meetings.converted,
          provider: meetings.provider,
          repUserId: meetings.repUserId,
          startAt: meetings.startAt,
          joinUrl: meetings.joinUrl,
          conversationId: meetings.conversationId,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
        })
        .from(meetings)
        .leftJoin(contacts, eq(contacts.id, meetings.contactId))
        .where(and(ORG, keysetWhere(meetings, KEY, cursor)))
        .orderBy(...keysetOrder(KEY, cursor))
        .limit(PAGE_SIZE + 1),
    ),
    getCurrentRole(),
    // The org's own people a meeting can be given to (explicit org filter; support staff are not reps).
    org
      ? withOrg((tx) =>
          tx
            .select({ userId: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, support: memberships.support })
            .from(memberships)
            .innerJoin(users, eq(users.id, memberships.userId))
            .where(and(eq(memberships.orgId, org.id), eq(memberships.support, false))),
        )
      : Promise.resolve([]),
    // Booked by rep: the same set as the Booked figure (made in the window, not cancelled).
    withOrg((tx) =>
      tx
        .select({ repUserId: meetings.repUserId, n: sql<number>`count(*)`.mapWith(Number) })
        .from(meetings)
        .where(and(ORG, sql`${meetings.createdAt} >= ${windowStart} and ${meetings.status} <> 'cancelled'`))
        .groupBy(meetings.repUserId),
    ),
  ]);
  const { options: repChoices, names: repNames } = repOptions(members);
  const repRows = tallyReps(byRep, repNames);
  const canAssign = role === "rep" || role === "admin" || role === "owner";
  const page = finishPage(fetched, cursor);

  const col = (k: "showed" | "noShows" | "converted" | "marked") => toSeries(heldDaily.map((r) => ({ ago: r.ago, n: r[k] })), buckets);
  const series = { booked: toSeries(bookedDaily, buckets), showed: col("showed"), noShows: col("noShows"), converted: col("converted") };
  const was = prior ?? { booked: 0, showed: 0, noShows: 0, converted: 0 };
  const versus = priorLabel(days);
  const tiles: { key: keyof typeof series; label: string; tone: "brand" | "success" | "danger" | "violet"; good: Good }[] = [
    { key: "booked", label: "Booked", tone: "brand", good: "up" },
    { key: "showed", label: "Showed", tone: "success", good: "up" },
    { key: "noShows", label: "No-shows", tone: "danger", good: "down" },
    { key: "converted", label: "Converted", tone: "violet", good: "up" },
  ];
  // Show rate as the dashboard counts it: showed over every meeting with an outcome marked.
  const showedN = sum(series.showed);
  const markedN = sum(col("marked"));
  const showRate = showRatePct(showedN, markedN);
  const todayIso = clock?.today ?? new Date().toISOString().slice(0, 10);
  const labels = bucketLabels(todayIso, days);
  const shorts = bucketShortLabels(todayIso, days);
  const points = series.booked.map((n, i) => ({ label: labels[i] ?? "", short: shorts[i] ?? "", n }));

  // The calendar the agent books into: the chosen tool, while it is still connected.
  const connected = connectedBookingTools(bookingSnapshot(profile), (k) => secretKeys.includes(k));
  const calendar = isBookingTool(profile?.bookingTool) ? connected.find((c) => c.tool === profile?.bookingTool) : undefined;
  const nextName = next ? displayName(next.firstName, next.lastName, next.email) : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Meetings" description={`Booked by the agent, with the outcome your reps record. Times in ${tzLabel(tz)}`}>
        <WindowSwitch value={days} />
      </PageHeader>

      {/* Info strip (boards `.info`): show rate, next meeting, the booking calendar. */}
      <dl className="grid grid-cols-1 overflow-hidden rounded-sm border border-hairline bg-sunken sm:grid-cols-3 sm:divide-x sm:divide-hairline">
        <div className="min-w-0 px-3.5 py-[9px]">
          <dt className="text-[12px] font-[550] uppercase tracking-[0.05em] text-ink-muted">Show rate</dt>
          <dd className="mt-0.5 truncate font-[550]">
            {showRate === null ? (
              <span className="font-normal text-ink-muted">Nothing marked yet</span>
            ) : (
              <>
                <span className="tabular font-mono">{showRate}%</span>{" "}
                <span className="font-normal text-ink-muted">
                  {showedN} of {markedN} held
                </span>
              </>
            )}
          </dd>
        </div>
        <div className="min-w-0 px-3.5 py-[9px]">
          <dt className="text-[12px] font-[550] uppercase tracking-[0.05em] text-ink-muted">Next meeting</dt>
          <dd className="mt-0.5 truncate font-[550]">
            {next && nextName ? (
              <>
                <span className="tabular font-mono">{fmtShort(next.startAt, tz)}</span> {nextName}
              </>
            ) : (
              <span className="font-normal text-ink-muted">None booked</span>
            )}
          </dd>
        </div>
        <div className="relative min-w-0 px-3.5 py-[9px]">
          <dt className="text-[12px] font-[550] uppercase tracking-[0.05em] text-ink-muted">Your calendar</dt>
          <dd className="mt-0.5 flex items-center gap-2 pr-9 font-[550]">
            {calendar ? (
              <>
                {calendar.label} <Pill tone="success">Connected</Pill>
              </>
            ) : (
              <span className="font-normal text-ink-muted">None connected</span>
            )}
          </dd>
          <Link
            href="/workspace/integrations"
            title="Manage"
            className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-xs text-ink-muted transition-colors duration-150 ease-out hover:bg-raised hover:text-ink motion-reduce:transition-none"
          >
            <Settings className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Manage calendar</span>
          </Link>
        </div>
      </dl>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Meeting figures">
        {tiles.map((t) => {
          const d = deltaView(sum(series[t.key]), was[t.key], t.good, versus);
          return (
            <StatTile
              key={t.key}
              label={t.label}
              value={sum(series[t.key])}
              tone={t.tone}
              series={series[t.key]}
              seriesLabels={labels}
              unit="meetings"
              period={bucket}
              delta={d.favourable ? d.text : undefined}
              hint={d.favourable ? undefined : d.text}
            />
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card boxed>
          <CardHeader title={`Booked per ${bucket}`} hint={days === 1 ? "Today" : `Last ${days} days`} />
          <TrendChart points={points} unit="meetings" kind="columns" tone="brand" width={640} />
        </Card>
        <Card boxed>
          <CardHeader title="Booked by rep" hint={days === 1 ? "Today" : `Last ${days} days`} />
          {repRows.length === 0 ? <p className="text-sm text-ink-muted">No meetings booked in this window.</p> : <Donut rows={repRows} unit="meetings" />}
        </Card>
      </section>

      <Card boxed padding="none">
        <div className="flex flex-wrap items-center gap-x-2 border-b border-hairline bg-sunken px-3.5 py-[9px]">
          <h2 className="font-display text-[14px] font-semibold leading-5 text-ink">Meetings</h2>
          <p className="text-label text-ink-muted">Latest start first, {PAGE_SIZE} per page.</p>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Contact</Th>
              <Th>When</Th>
              <Th>Status</Th>
              <Th>Rep</Th>
              <Th>Source</Th>
              <Th>Outcome</Th>
              <Th className="text-right">Manage</Th>
            </tr>
          </thead>
          <tbody>
            {page.rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                {cursor ? (
                  <>
                    This page is empty — the list has changed since this link was made. <Link href="/meetings">Go to page 1</Link>.
                  </>
                ) : (
                  "No meetings booked yet."
                )}
              </EmptyRow>
            ) : (
              page.rows.map((m) => {
                const status = MEETING_STATUS[m.status];
                const who = displayName(m.firstName, m.lastName, m.email);
                return (
                  <Tr key={m.id}>
                    <Td>
                      {m.conversationId ? (
                        <Link href={`/conversations/${m.conversationId}`} transitionTypes={["nav-forward"]} className="font-semibold text-ink no-underline hover:underline">
                          {who}
                        </Link>
                      ) : (
                        <span className="font-semibold">{who}</span>
                      )}
                      {m.joinUrl && (
                        <a href={m.joinUrl} target="_blank" rel="noopener noreferrer" className="block text-label">
                          Join link
                        </a>
                      )}
                    </Td>
                    <Td className="tabular whitespace-nowrap font-mono text-[12px] text-ink-muted">{fmtDateTime(m.startAt, tz)}</Td>
                    <Td>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </Td>
                    <Td>
                      <RepControl id={m.id} rep={m.repUserId && repNames.has(m.repUserId) ? m.repUserId : ""} options={repChoices} canAssign={canAssign} />
                    </Td>
                    <Td className="text-ink-muted">{PROVIDER_LABEL[m.provider]}</Td>
                    <Td>
                      <OutcomeControls id={m.id} status={m.status} outcome={m.outcome} converted={m.converted} />
                    </Td>
                    <Td className="text-right">
                      <ManageControls id={m.id} provider={m.provider} status={m.status} contact={who} />
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
        <Pager prev={page.newer} next={page.older} page={page.page} pages={pageCount(total[0]?.n ?? 0)} href={cursorHref("/meetings")} />
      </Card>
    </div>
  );
}
