import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { orgSubscriptions, plans } from "@alevo/db";
import { withOrg } from "@alevo/auth";
import { AppSidebar, type PlanCard } from "@/components/app-sidebar";
import { AgentStatus } from "@/components/agent-status";
import { UserMenu } from "@/components/user-menu";
import { MobileMenu } from "@/components/mobile-menu";
import { getAgentOn } from "@/lib/agent-on";
import { getCurrentUsage } from "@/lib/usage/current";
import { UsageBanner } from "@/components/usage-banner";

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
  const [plan, agentOn, usage] = orgId ? await Promise.all([loadPlan(), getAgentOn(), getCurrentUsage()]) : [null, false, []];

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div className="hidden md:flex">
        <AppSidebar plan={plan} agentOn={agentOn} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: burger menu + logo on mobile, logo on desktop, account menu on the right.
            The agent status sits left of the avatar on phones; desktop has it in the sidebar. */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 md:px-10">
          <div className="flex items-center gap-3">
            <MobileMenu plan={plan} />
            <Link href="/dashboard" className="flex items-center gap-3 text-ink no-underline">
              <Image src="/alevo-mark.png" alt="" width={28} height={28} priority className="size-7" />
              <span className="font-display text-lg font-semibold tracking-tight">Alevo</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {orgId && <AgentStatus on={agentOn} compact className="md:hidden" />}
            <UserMenu />
          </div>
        </div>
        <main className="min-w-0 flex-1 px-4 pb-6 md:px-10 md:pb-8">
          <UsageBanner rows={usage} />
          {children}
        </main>
      </div>
    </div>
  );
}
