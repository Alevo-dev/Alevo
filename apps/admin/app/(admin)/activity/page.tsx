import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_SIZE, parseCursor } from "@alevo/db";
import { Card } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { cursorHref, Pager } from "@alevo/ui/pager";
import { ActivityTable } from "@/components/activity-table";
import { activityPage } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity" };

/** The whole audit log, a page at a time. The dashboard shows only the newest page. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);
  const page = await activityPage(cursor);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description={`The audit log across every organization, newest first, ${PAGE_SIZE} to a page.`} />
      <Card padding="none">
        <ActivityTable
          rows={page.rows}
          actor
          empty={
            cursor ? (
              <>
                Nothing on this page. <Link href="/activity">Back to the newest</Link>.
              </>
            ) : (
              "No activity yet."
            )
          }
        />
        <Pager newer={page.newer} older={page.older} href={cursorHref("/activity")} label={`${page.rows.length} on this page`} />
      </Card>
    </div>
  );
}
