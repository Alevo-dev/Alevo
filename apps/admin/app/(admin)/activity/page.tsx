import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_SIZE, pageCount, parseCursor } from "@alevo/db";
import { Card } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { cursorHref, Pager } from "@alevo/ui/pager";
import { ActivityTable } from "@/components/activity-table";
import { activityCount, activityPage } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity" };

/** The whole audit log, a page at a time. The dashboard shows only the newest page. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);
  const [page, total] = await Promise.all([activityPage(cursor), activityCount()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description={`The audit log across every organization. Newest first, ${PAGE_SIZE} per page.`} />
      <Card padding="none">
        <ActivityTable
          rows={page.rows}
          actor
          empty={
            cursor ? (
              <>
                This page is empty — the log has changed since this link was made. <Link href="/activity">Go to page 1</Link>.
              </>
            ) : (
              "No activity yet."
            )
          }
        />
        <Pager prev={page.newer} next={page.older} page={page.page} pages={pageCount(total)} href={cursorHref("/activity")} />
      </Card>
    </div>
  );
}
