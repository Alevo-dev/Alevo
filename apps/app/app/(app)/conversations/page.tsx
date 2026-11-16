import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Search } from "lucide-react";
import { PAGE_SIZE, pageCount, parseCursor } from "@alevo/db";
import { getCurrentOrg, withOrg } from "@alevo/auth";
import { Donut } from "@/app/(app)/dashboard/channel-donut";
import { TrendChart } from "@/app/(app)/dashboard/trend-chart";
import { WindowSwitch } from "@/app/(app)/dashboard/window-switch";
import { ClientsPanel } from "@/components/conversations/clients-panel";
import { deltaOf, Kpi, ScreenHeader, Strip, TabLinks } from "@/components/conversations/kit";
import { RefreshButton } from "@/components/conversations/refresh-button";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cursorHref } from "@/components/ui/pager";
import { clientOverview } from "@/lib/clients/overview";
import { clientCount, clientsPage, clientTabCounts, parseFilter, type ClientFilter } from "@/lib/clients/queries";
import type { ListRow } from "@/lib/clients/list-view";
import { cx } from "@/lib/cx";
import { readWindow } from "@/lib/dashboard/window-pref";
import { bucketFor, bucketLabels, bucketShortLabels, parseWindow, priorLabel, windowLabel, windowRange } from "@/lib/dashboard/window";
import { anonymousLabel, displayName, fmtShort } from "@/lib/format";
import { getOrgTimezone } from "@/lib/org-timezone";
import { CHANNEL_LABEL } from "@/lib/ui/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conversations" };

const TABS: { key: ClientFilter; label: string }[] = [
  { key: "all", label: "All clients" },
  { key: "open", label: "Open" },
  { key: "handed_off", label: "Handed off" },
  { key: "booked", label: "Booked" },
  { key: "disqualified", label: "Not a fit" },
];

/** Donut order and colours for where the window's new clients ended up. */
const ENDS = [
  { key: "booked", label: "Booked", color: "var(--color-success)" },
  { key: "open", label: "Open", color: "var(--color-brand)" },
  { key: "handed_off", label: "Handed off", color: "var(--color-violet)" },
  { key: "disqualified", label: "Not a fit", color: "var(--color-ink-muted)" },
  { key: "closed", label: "Closed", color: "var(--color-warning)" },
  { key: "none", label: "No conversation", color: "var(--color-control)" },
] as const;

type Search = { cursor?: string; window?: string; status?: string; q?: string };

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

/**
 * Conversations, organised by client: one row per contact, most recent activity
 * first. Above the list: the window's key figures and two charts; tabs filter by
 * the client's latest status and the box by name, company, email or phone.
 * A row opens the client page. Explicit org id on every read: platform admins bypass RLS.
 */
export default async function ConversationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [cursor, org, tz] = await Promise.all([parseCursor(sp.cursor), getCurrentOrg(), getOrgTimezone()]);
  if (!org) return null;
  const days = await readWindow();
  const filter = parseFilter(sp.status);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const [page, total, tabs, ov] = await Promise.all([
    withOrg((tx) => clientsPage(tx, org.id, cursor, { filter, q })),
    withOrg((tx) => clientCount(tx, org.id, { filter, q })),
    withOrg((tx) => clientTabCounts(tx, org.id)),
    withOrg((tx) => clientOverview(tx, org.id, days, tz)),
  ]);

  const bucket = bucketFor(days);
  const labels = bucketLabels(ov.today, days);
  const shorts = bucketShortLabels(ov.today, days);
  const points = ov.series.clients.map((n, i) => ({ label: labels[i] ?? "", short: shorts[i] ?? "", n }));
  const vs = priorLabel(days);
  const t = { clients: sum(ov.series.clients), conversations: sum(ov.series.conversations), booked: sum(ov.series.booked), handed: sum(ov.series.handed) };

  // Latest-status groups for the donut: open = new + active.
  const ended = new Map<string, number>();
  for (const r of ov.endsUp) {
    const k = r.status === "new" || r.status === "active" ? "open" : r.status;
    ended.set(k, (ended.get(k) ?? 0) + r.n);
  }
  const endsRows = ENDS.map((e) => ({ ...e, n: ended.get(e.key) ?? 0 })).filter((e) => e.n > 0);

  const windowParam = sp.window ? String(days) : undefined;
  const tabHref = (status: ClientFilter) => {
    const p = new URLSearchParams();
    if (windowParam) p.set("window", windowParam);
    if (status !== "all") p.set("status", status);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/conversations?${s}` : "/conversations";
  };
  const pageHref = cursorHref("/conversations", { window: windowParam, status: filter === "all" ? undefined : filter, q: q || undefined });
  const exportParams = new URLSearchParams();
  if (filter !== "all") exportParams.set("status", filter);
  if (q) exportParams.set("q", q);
  const exportHref = `/conversations/export${exportParams.size ? `?${exportParams}` : ""}`;
  const listRows: ListRow[] = page.rows.map((r) => ({
    id: r.id,
    name: displayName(r.firstName, r.lastName, r.email ?? r.phone ?? (r.channels.length === 1 && r.channels[0] === "chat" ? "Website visitor" : r.channels.includes("voice") ? "Unknown caller" : (anonymousLabel(r.channels[0]) ?? "New client"))),
    sub: r.company ?? r.email ?? "",
    channels: r.channels,
    status: r.latestStatus,
    maxFit: r.maxFit,
    openCount: r.openCount,
    activityAt: r.lastActivityAt.getTime(),
    activityLabel: fmtShort(r.lastActivityAt, tz),
    timezone: r.timezone,
    consentSource: r.consentSource,
  }));
  const from = (page.page - 1) * PAGE_SIZE + 1;
  const pages = pageCount(total);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Conversations" sub="One row per person, across every channel">
        <WindowSwitch value={days} />
        <RefreshButton />
      </ScreenHeader>

      <Strip
        items={[
          { k: "Open now", v: <span className="tabular">{ov.openNow}</span> },
          { k: "Window", v: windowRange(ov.today, days) },
          { k: "Busiest channel", v: ov.busiest ? CHANNEL_LABEL[ov.busiest] : "—" },
          { k: "Timezone", v: tz },
          { k: "Last activity", v: ov.lastActivity ? fmtShort(ov.lastActivity, tz) : "—" },
        ]}
      />

      <TabLinks label="Client groups" tabs={TABS.map((x) => ({ label: x.label, href: tabHref(x.key), count: tabs[x.key], active: x.key === filter }))} />

      <section className="grid grid-cols-2 border-y border-hairline lg:grid-cols-4" aria-label="Key figures">
        <Kpi label="New clients" value={t.clients} delta={deltaOf(t.clients, ov.prior.clients, vs)} series={ov.series.clients} seriesLabels={labels} unit="clients" period={bucket} tone="brand" />
        <Kpi label="Conversations" value={t.conversations} delta={deltaOf(t.conversations, ov.prior.conversations, vs)} series={ov.series.conversations} seriesLabels={labels} unit="conversations" period={bucket} tone="violet" />
        <Kpi label="Booked" value={t.booked} delta={deltaOf(t.booked, ov.prior.booked, vs)} series={ov.series.booked} seriesLabels={labels} unit="booked" period={bucket} tone="success" />
        <Kpi label="Handed to a person" value={t.handed} delta={deltaOf(t.handed, ov.prior.handed, vs)} series={ov.series.handed} seriesLabels={labels} unit="handed off" period={bucket} tone="warning" />
      </section>

      <section className="grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" aria-label="Clients over time">
        <Card>
          <CardHeader title={`Clients per ${bucket}`} hint={windowLabel(days)} />
          <TrendChart points={points} unit="clients" kind="area" tone="brand" />
        </Card>
        <Card>
          <CardHeader title="Where clients end up" hint={windowLabel(days)} />
          {endsRows.length === 0 ? <p className="text-sm text-ink-muted">No new clients in this window.</p> : <Donut rows={endsRows} unit="clients" />}
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-1.5">
        <a href={`/form/${org.id}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          <ExternalLink className="size-[15px] text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
          Open lead form
        </a>
        <a href={exportHref} className={buttonClass("secondary", "sm")}>
          <Download className="size-[15px] text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
          Export
        </a>
        <form action="/conversations" role="search" className="relative ml-auto w-full min-w-[240px] sm:w-60">
          {windowParam && <input type="hidden" name="window" value={windowParam} />}
          {filter !== "all" && <input type="hidden" name="status" value={filter} />}
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
          <Input name="q" type="search" defaultValue={q} aria-label="Filter clients" placeholder="Filter clients" className="pl-8" />
        </form>
      </div>

      <ClientsPanel
        rows={listRows}
        empty={
          cursor ? (
            <>
              This page is empty — the list has changed since this link was made. <Link href={tabHref(filter)}>Go to page 1</Link>.
            </>
          ) : q || filter !== "all" ? (
            "No clients match."
          ) : (
            "No clients yet. Submit your lead form to create one."
          )
        }
        footer={
          <>
            <span>{total === 0 ? "No clients" : `Showing ${from}–${from + page.rows.length - 1} of ${total} clients`}</span>
            <nav aria-label="Pages" className="ml-auto flex items-center gap-2">
              {pages > 1 && (
                <span className="mr-1">
                  Page {page.page} of {pages}
                </span>
              )}
              <PageLink href={page.newer ? pageHref(page.newer) : null} rel="prev">
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </PageLink>
              <PageLink href={page.older ? pageHref(page.older) : null} rel="next">
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </PageLink>
            </nav>
          </>
        }
      />
    </div>
  );
}

function PageLink({ href, rel, children }: { href: string | null; rel: "prev" | "next"; children: React.ReactNode }) {
  const cls = buttonClass("secondary", "sm");
  if (!href) {
    return (
      <span aria-disabled="true" className={cx(cls, "cursor-not-allowed opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={cx(cls, "no-underline")}>
      {children}
    </Link>
  );
}
