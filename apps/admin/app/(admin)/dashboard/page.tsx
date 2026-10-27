import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { auditLog, funnelByOrg, funnelSeries, memberships, orgProfiles, orgSubscriptions, organizations, plans, withService } from "@alevo/db";
import { Card, CardHeader } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { Pill, StatusDot } from "@alevo/ui/pill";
import { StatTile } from "@alevo/ui/stat-tile";
import { EmptyRow, Table, Td, Th, Tr } from "@alevo/ui/table";
import { WindowSwitch } from "@alevo/ui/window-switch";
import { bucketCount, fmtDuration, fmtWhen, parseWindow, pct, speedView, toSeries, WINDOWS } from "@/lib/metrics-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Across all organizations" };

const NUM = "tabular text-right font-mono";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const days = parseWindow((await searchParams).window);

  // Access is gated by the (admin) layout (requirePlatformAdmin). Cross-org
  // reads go through the service path.
  const [orgs, funnel, buckets, recent] = await Promise.all([
    withService((tx) =>
      tx
        .select({
          id: organizations.id,
          name: organizations.name,
          createdAt: organizations.createdAt,
          planName: plans.name,
          status: orgSubscriptions.status,
          agentOn: orgProfiles.enabled,
          memberCount: sql<number>`count(distinct ${memberships.id})`.mapWith(Number),
        })
        .from(organizations)
        .leftJoin(memberships, eq(memberships.orgId, organizations.id))
        .leftJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
        .leftJoin(plans, eq(plans.id, orgSubscriptions.planId))
        .leftJoin(orgProfiles, eq(orgProfiles.orgId, organizations.id))
        .groupBy(organizations.id, plans.name, orgSubscriptions.status, orgProfiles.enabled)
        .orderBy(desc(organizations.createdAt)),
    ),
    funnelByOrg(days),
    funnelSeries(days),
    withService((tx) =>
      tx
        .select({ id: auditLog.id, action: auditLog.action, target: auditLog.target, orgId: auditLog.orgId, createdAt: auditLog.createdAt })
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(25),
    ),
  ]);

  const funnelOf = new Map(funnel.map((f) => [f.orgId, f]));
  const nameOf = new Map(orgs.map((o) => [o.id, o.name]));
  const totals = funnel.reduce(
    (t, f) => ({ leads: t.leads + f.leads, qualified: t.qualified + f.qualified, meetings: t.meetings + f.meetings, calls: t.calls + f.calls }),
    { leads: 0, qualified: 0, meetings: 0, calls: 0 },
  );
  const slow = funnel.filter((f) => speedView(f.p95, f.replied).tone === "danger" || speedView(f.p95, f.replied).tone === "warning").length;
  const live = orgs.filter((o) => o.agentOn).length;
  // Per-period totals across every org for the tiles' mini bars (same shape as the app's).
  const n = bucketCount(days);
  const series = {
    leads: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.leads })), n),
    qualified: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.qualified })), n),
    meetings: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.meetings })), n),
    calls: toSeries(buckets.map((b) => ({ ago: b.ago, n: b.calls })), n),
  };
  // Busiest first; orgs with nothing in the window sink to the bottom.
  const ranked = [...orgs].sort((a, b) => (funnelOf.get(b.id)?.leads ?? 0) - (funnelOf.get(a.id)?.leads ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Across all organizations"
        description={
          <>
            <StatusDot tone={live > 0 ? "success" : "muted"} live={live > 0} />
            {live} of {orgs.length} agents on, last {days} days
          </>
        }
      >
        <WindowSwitch value={days} windows={WINDOWS} />
      </PageHeader>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-label="Platform totals">
        <StatTile label="Leads in" value={totals.leads} delta={`Last ${days} days`} series={series.leads} featured />
        <StatTile label="Qualified" value={totals.qualified} delta={totals.leads ? `${pct(totals.qualified, totals.leads)} of leads` : "Booked or handed off"} series={series.qualified} tone="violet" />
        <StatTile label="Meetings booked" value={totals.meetings} delta={totals.leads ? `${pct(totals.meetings, totals.leads)} conversion` : `Last ${days} days`} series={series.meetings} tone="success" />
        <StatTile label="Calls answered" value={totals.calls} delta="By the agent" series={series.calls} tone="warning" />
        <StatTile label="Over 60s" value={slow} hint={slow ? "Orgs replying slower than target" : "Every org on target"} tone="danger" />
      </section>

      <Card padding="none">
        <div className="px-6 pt-6">
          <CardHeader title="Funnel per organization" hint={`What each tenant's dashboard shows for the last ${days} days. Speed to lead is the p95 first reply against the 60-second promise.`} />
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
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" aria-label="Organizations and activity">
        <Card padding="none">
          <div className="px-6 pt-6">
            <CardHeader title="Organizations" aside={`${orgs.length} total`} />
          </div>
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th className="text-right">Members</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <EmptyRow colSpan={5}>No organizations yet.</EmptyRow>
              ) : (
                orgs.map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-medium text-ink">{o.name}</Td>
                    <Td className={NUM}>{o.memberCount}</Td>
                    <Td className="text-ink-muted">{o.planName ?? "—"}</Td>
                    <Td>
                      <Pill tone={o.status === "active" ? "success" : o.status === "trialing" ? "brand" : o.status ? "warning" : "muted"}>
                        {o.status ? o.status.replace("_", " ") : "No plan"}
                      </Pill>
                    </Td>
                    <Td className="tabular font-mono text-label text-ink-muted">{fmtWhen(o.createdAt)}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>

        <Card padding="none">
          <div className="px-6 pt-6">
            <CardHeader title="Recent activity" hint="The audit log across every org, newest first." />
          </div>
          <Table className="mt-2">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Org</Th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <EmptyRow colSpan={4}>No activity yet.</EmptyRow>
              ) : (
                recent.map((a) => (
                  <Tr key={a.id}>
                    <Td className="tabular whitespace-nowrap font-mono text-label text-ink-muted">{fmtWhen(a.createdAt)}</Td>
                    <Td className="font-mono text-label text-ink">{a.action}</Td>
                    <Td className="max-w-[220px] truncate text-ink-muted">{a.target ?? "—"}</Td>
                    <Td className="text-ink-muted">{a.orgId ? (nameOf.get(a.orgId) ?? a.orgId.slice(0, 8)) : "—"}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
