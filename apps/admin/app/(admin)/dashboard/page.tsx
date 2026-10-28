import type { Metadata } from "next";
import { funnelByOrg, funnelSeries, PAGE_SIZE } from "@alevo/db";
import { Card, CardHeader } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { Pill, StatusDot } from "@alevo/ui/pill";
import { StatTile } from "@alevo/ui/stat-tile";
import { EmptyRow, Table, Td, Th, Tr } from "@alevo/ui/table";
import { WindowSwitch } from "@alevo/ui/window-switch";
import { ActivityTable } from "@/components/activity-table";
import { OrgsTable } from "@/components/orgs-table";
import { ViewAll } from "@/components/view-all";
import { activityPage } from "@/lib/activity";
import { bucketCount, fmtDuration, parseWindow, pct, speedView, toSeries, WINDOWS } from "@/lib/metrics-format";
import { orgCounts, orgsById, orgsPage, type OrgRow } from "@/lib/orgs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Across all organizations" };

const NUM = "tabular text-right font-mono";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const days = parseWindow((await searchParams).window);

  // Access is gated by the (admin) layout (requirePlatformAdmin). Cross-org
  // reads go through the service path. Every list here is one page; the
  // dedicated pages (/organizations, /activity) walk through the rest.
  const [counts, funnel, buckets, newest, activity] = await Promise.all([
    orgCounts(),
    funnelByOrg(days),
    funnelSeries(days),
    orgsPage(null),
    activityPage(null),
  ]);

  // Busiest orgs first; the newest quiet ones fill the remaining seats so a
  // fresh tenant still shows up. Org details come from the newest page when
  // possible, one extra read for the busy ones not on it.
  const funnelOf = new Map(funnel.map((f) => [f.orgId, f]));
  const busiest = [...funnel].sort((a, b) => b.leads - a.leads).slice(0, PAGE_SIZE);
  const orgOf = new Map<string, OrgRow>(newest.rows.map((o) => [o.id, o]));
  for (const o of await orgsById(busiest.map((f) => f.orgId).filter((id) => !orgOf.has(id)))) orgOf.set(o.id, o);
  const ranked = [
    ...busiest.map((f) => orgOf.get(f.orgId)).filter((o): o is OrgRow => o != null),
    ...newest.rows.filter((o) => !funnelOf.has(o.id)),
  ].slice(0, PAGE_SIZE);

  const totals = funnel.reduce(
    (t, f) => ({ leads: t.leads + f.leads, qualified: t.qualified + f.qualified, meetings: t.meetings + f.meetings, calls: t.calls + f.calls }),
    { leads: 0, qualified: 0, meetings: 0, calls: 0 },
  );
  const slow = funnel.filter((f) => speedView(f.p95, f.replied).tone === "danger" || speedView(f.p95, f.replied).tone === "warning").length;
  // Per-period totals across every org for the tiles' mini bars (same shape as the app's).
  const n = bucketCount(days);
  const series = {
    leads: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.leads })), n),
    qualified: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.qualified })), n),
    meetings: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.meetings })), n),
    calls: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.calls })), n),
  };
  const moreOrgs = counts.total > ranked.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Across all organizations"
        description={
          <>
            <StatusDot tone={counts.live > 0 ? "success" : "muted"} live={counts.live > 0} />
            {counts.live} of {counts.total} agents on, last {days} days
          </>
        }
      >
        <WindowSwitch value={days} windows={WINDOWS} />
      </PageHeader>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-label="Platform totals">
        <StatTile label="Leads in" value={totals.leads} delta={`Last ${days} days`} series={series.leads} unit="leads" period={days >= 90 ? "week" : "day"} featured />
        <StatTile label="Qualified" value={totals.qualified} delta={totals.leads ? `${pct(totals.qualified, totals.leads)} of leads` : "Booked or handed off"} series={series.qualified} unit="qualified" period={days >= 90 ? "week" : "day"} tone="violet" />
        <StatTile label="Meetings booked" value={totals.meetings} delta={totals.leads ? `${pct(totals.meetings, totals.leads)} conversion` : `Last ${days} days`} series={series.meetings} unit="meetings" period={days >= 90 ? "week" : "day"} tone="success" />
        <StatTile label="Calls answered" value={totals.calls} delta="By the agent" series={series.calls} unit="calls" period={days >= 90 ? "week" : "day"} tone="warning" />
        <StatTile label="Over 60s" value={slow} hint={slow ? "Orgs replying slower than target" : "Every org on target"} tone="danger" />
      </section>

      <Card padding="none">
        <div className="px-6 pt-6">
          <CardHeader
            title="Funnel per organization"
            hint={`What each tenant's dashboard shows for the last ${days} days. Speed to lead is the p95 first reply against the 60-second promise.`}
            aside={moreOrgs ? `Busiest ${ranked.length} of ${counts.total}` : undefined}
          />
        </div>
        <Table className="mt-2">
          <thead>
            <tr>
              <Th>Organization</Th>
              <Th>Plan</Th>
              <Th>Agent</Th>
              <Th className="text-right">Leads</Th>
              <Th className="text-right">Qualified</Th>
              <Th className="text-right">Meetings</Th>
              <Th className="text-right">Calls</Th>
              <Th className="text-right">Median reply</Th>
              <Th className="text-right">p95 reply</Th>
              <Th>Speed to lead</Th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 ? (
              <EmptyRow colSpan={10}>No organizations yet.</EmptyRow>
            ) : (
              ranked.map((o) => {
                const f = funnelOf.get(o.id);
                const speed = speedView(f?.p95 ?? null, f?.replied ?? 0);
                return (
                  <Tr key={o.id}>
                    <Td className="font-medium text-ink">{o.name}</Td>
                    <Td className="text-ink-muted">{o.planName ?? "—"}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-2 text-label text-ink">
                        <StatusDot tone={o.agentOn ? "success" : "muted"} />
                        {o.agentOn ? "On" : "Off"}
                      </span>
                    </Td>
                    <Td className={NUM}>{f?.leads ?? 0}</Td>
                    <Td className={NUM}>
                      {f?.qualified ?? 0} <span className="text-ink-muted">({pct(f?.qualified ?? 0, f?.leads ?? 0)})</span>
                    </Td>
                    <Td className={NUM}>{f?.meetings ?? 0}</Td>
                    <Td className={NUM}>{f?.calls ?? 0}</Td>
                    <Td className={NUM}>{fmtDuration(f?.p50 ?? null)}</Td>
                    <Td className={NUM}>{fmtDuration(f?.p95 ?? null)}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <Pill tone={speed.tone}>{speed.label}</Pill>
                        {f && f.replied > 0 && <span className="text-label text-ink-muted">{f.replied} answered</span>}
                      </span>
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
        {moreOrgs && <ViewAll href="/organizations">All organizations</ViewAll>}
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-label="Organizations and activity">
        <Card padding="none">
          <div className="px-6 pt-6">
            <CardHeader title="Organizations" aside={`${counts.total} total`} />
          </div>
          <OrgsTable rows={newest.rows} className="mt-2" empty="No organizations yet." />
          {newest.older && (
            <ViewAll href="/organizations" label={`Newest ${newest.rows.length} of ${counts.total}`}>
              All organizations
            </ViewAll>
          )}
        </Card>

        <Card padding="none">
          <div className="px-6 pt-6">
            <CardHeader title="Recent activity" hint="The audit log across every org, newest first." />
          </div>
          <ActivityTable rows={activity.rows} className="mt-2" empty="No activity yet." />
          {activity.older && (
            <ViewAll href="/activity" label={`Newest ${activity.rows.length}`}>
              All activity
            </ViewAll>
          )}
        </Card>
      </section>
    </div>
  );
}
