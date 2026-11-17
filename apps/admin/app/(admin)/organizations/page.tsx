import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { funnelByOrg, funnelSeries, PAGE_SIZE, pageCount, parseCursor } from "@alevo/db";
import { buttonClass } from "@alevo/ui/button";
import { Card, CardFooter, CardHeader } from "@alevo/ui/card";
import { cx } from "@alevo/ui/cx";
import { PageHeader } from "@alevo/ui/page-header";
import { cursorHref } from "@alevo/ui/pager";
import { StatTile } from "@alevo/ui/stat-tile";
import { WindowSwitch } from "@alevo/ui/window-switch";
import { bucketCount, fmtDuration, parseWindow, periodFor, speedView, toSeries, windowText, WINDOWS } from "@/lib/metrics-format";
import { orgsPage, orgTotals } from "@/lib/orgs";
import { activePlans } from "@/lib/plans";
import { NewOrgDialogButton } from "./new-org-dialog";
import { OrgToolbar } from "./org-toolbar";
import { OrgsListTable } from "./orgs-list-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organizations" };

/** Every tenant, newest first, a page at a time, with the window's funnel numbers per org. */
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ cursor?: string; window?: string; q?: string }> }) {
  const sp = await searchParams;
  const cursor = parseCursor(sp.cursor);
  const days = parseWindow(sp.window, 30);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const [totals, page, plans, funnel, prior, buckets] = await Promise.all([
    orgTotals(q, days),
    orgsPage(cursor, q),
    activePlans(),
    funnelByOrg(days),
    funnelByOrg(days * 2),
    funnelSeries(days),
  ]);

  const funnelOf = new Map(funnel.map((f) => [f.orgId, f]));
  const sum = (rows: typeof funnel) => rows.reduce((t, f) => ({ leads: t.leads + f.leads, replied: t.replied + f.replied, median: t.median + (f.p50 ?? 0) * f.replied }), { leads: 0, replied: 0, median: 0 });
  const now = sum(funnel);
  // The window before this one = the double window minus this one.
  const lastLeads = sum(prior).leads - now.leads;
  const diff = now.leads - lastLeads;
  const before = days === 1 ? "day before" : `last ${days} days`;
  const slow = funnel.filter((f) => ["danger", "warning"].includes(speedView(f.p95, f.replied).tone)).length;
  const n = bucketCount(days);
  const leadSeries = toSeries(buckets.map((b) => ({ ago: b.ago, n: b.leads })), n);
  const total = await orgTotals("", days).then((t) => t.matching);

  const first = page.rows.length ? (page.page - 1) * PAGE_SIZE + 1 : 0;
  const href = cursorHref("/organizations", { q: q || undefined, window: String(days) });

  return (
    <div className="space-y-5">
      <PageHeader title="Organizations">
        <WindowSwitch value={days} windows={WINDOWS} basePath="/organizations" />
        <NewOrgDialogButton plans={plans} />
      </PageHeader>

      <section className="grid grid-cols-2 border-y border-hairline lg:grid-cols-4" aria-label="Platform totals">
        <StatTile label="Organizations" value={total} delta={totals.recent ? `${totals.recent} new ${windowText(days)}` : undefined} hint={totals.recent ? undefined : `None new ${windowText(days)}`} />
        <StatTile
          label="Leads"
          value={now.leads}
          tone="violet"
          series={leadSeries}
          unit="leads"
          period={periodFor(days)}
          delta={diff > 0 ? `${diff.toLocaleString("en-US")} more than the ${before}` : undefined}
          hint={diff > 0 ? undefined : `${Math.abs(diff).toLocaleString("en-US")} fewer than the ${before}`}
        />
        <StatTile label="Median reply" value={now.replied ? fmtDuration(now.median / now.replied) : "—"} tone="success" hint={`${now.replied.toLocaleString("en-US")} answered, ${windowText(days)}`} />
        <StatTile label="Needs attention" value={slow} tone="warning" hint={slow ? "Orgs replying over the 60-second target" : "Every org on target"} />
      </section>

      <OrgToolbar q={q} days={days} />

      <Card padding="none">
        <CardHeader title="Organizations" hint="Newest first; p95 over 60 seconds is flagged" />
        <OrgsListTable
          rows={page.rows}
          funnel={funnelOf}
          empty={
            q ? (
              <>
                No organization matches “{q}”. <Link href="/organizations">Clear the filter</Link>.
              </>
            ) : cursor ? (
              <>
                This page is empty — the list has changed since this link was made. <Link href="/organizations">Go to page 1</Link>.
              </>
            ) : (
              "No organizations yet."
            )
          }
        />
        <CardFooter>
          <span>{page.rows.length ? `Showing ${first}–${first + page.rows.length - 1} of ${totals.matching} organizations` : "No organizations to show"}</span>
          {(page.newer || page.older) && (
            <nav aria-label="Pages" className="flex items-center gap-2">
              <span>
                Page {page.page} of {pageCount(totals.matching)}
              </span>
              <PageLink href={page.newer ? href(page.newer) : null} rel="prev">
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </PageLink>
              <PageLink href={page.older ? href(page.older) : null} rel="next">
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </PageLink>
            </nav>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

/** Previous / Next in the footer: a link, or a muted span when there is nowhere to go. */
function PageLink({ href, rel, children }: { href: string | null; rel: "prev" | "next"; children: React.ReactNode }) {
  const className = buttonClass("secondary", "sm");
  if (!href) {
    return (
      <span aria-disabled="true" className={cx(className, "cursor-not-allowed opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={cx(className, "no-underline")}>
      {children}
    </Link>
  );
}
