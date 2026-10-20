import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { orgSubscriptions, plans } from "@alevo/db";
import { withOrg } from "@alevo/auth";
import { AppSidebar, type PlanCard } from "@/components/app-sidebar";

/** The org's plan for the sidebar card (explicitly scoped to the active org). */
async function loadPlan(): Promise<PlanCard> {
  const [row] = await withOrg((tx) =>
    tx
      .select({ name: plans.name, periodEnd: orgSubscriptions.currentPeriodEnd })
      .from(orgSubscriptions)
      .innerJoin(plans, eq(plans.id, orgSubscriptions.planId))
      .where(sql`${orgSubscriptions.orgId} = (select app.current_org_id())`)
      .limit(1),
  );
  if (!row) return null;
  const renews = row.periodEnd
    ? new Date(row.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  return { name: row.name, renews };
}

/** Shell for every authenticated, org-scoped route: sidebar + content column. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();
  const plan = orgId ? await loadPlan() : null;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppSidebar plan={plan} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: the account menu lives at the top right of the screen. */}
        <div className="flex h-14 shrink-0 items-center justify-end px-4 md:px-10">
          <UserButton />
        </div>
        <main className="min-w-0 flex-1 px-4 pb-6 md:px-10 md:pb-8">{children}</main>
      </div>
    </div>
  );
}
