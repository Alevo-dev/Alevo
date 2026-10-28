import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_SIZE, pageCount, parseCursor } from "@alevo/db";
import { Card } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { cursorHref, Pager } from "@alevo/ui/pager";
import { StatusDot } from "@alevo/ui/pill";
import { OrgsTable } from "@/components/orgs-table";
import { orgCounts, orgsPage } from "@/lib/orgs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organizations" };

/** Every tenant, newest first, a page at a time. */
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);
  const [counts, page] = await Promise.all([orgCounts(), orgsPage(cursor)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description={
          <>
            <StatusDot tone={counts.live > 0 ? "success" : "muted"} live={counts.live > 0} />
            {counts.live} of {counts.total} agents on. Newest first, {PAGE_SIZE} per page
          </>
        }
      />
      <Card padding="none">
        <OrgsTable
          rows={page.rows}
          empty={
            cursor ? (
              <>
                This page is empty — the list has changed since this link was made. <Link href="/organizations">Go to page 1</Link>.
              </>
            ) : (
              "No organizations yet."
            )
          }
        />
        <Pager prev={page.newer} next={page.older} page={page.page} pages={pageCount(counts.total)} href={cursorHref("/organizations")} />
      </Card>
    </div>
  );
}
