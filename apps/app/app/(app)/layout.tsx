import { auth } from "@clerk/nextjs/server";
import { getCurrentOrg, getCurrentUser } from "@alevo/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { Crumbs } from "@/components/crumbs";
import { TopBar } from "@/components/top-bar";
import { getAgentOn } from "@/lib/agent-on";
import { getCurrentUsage } from "@/lib/usage/current";
import { UsageBanner } from "@/components/usage-banner";

/** Shell for every authenticated, org-scoped route: top bar, then rail + content. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth();
  const [agentOn, usage, me, org] = orgId
    ? await Promise.all([getAgentOn(), getCurrentUsage(), getCurrentUser(), getCurrentOrg()])
    : [false, [], null, null];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar agentOn={agentOn} usage={usage} hasOrg={!!orgId} isPlatformAdmin={!!me?.isPlatformAdmin} />
      <div className="flex w-full min-w-0 flex-1">
        <div className="hidden md:flex">
          <AppSidebar />
        </div>
        <main className="min-w-0 flex-1 px-4 pb-6 pt-4 md:px-5 md:pb-8">
          <div className="mx-auto max-w-[1200px]">
            {org && <Crumbs org={org.name} />}
            <UsageBanner rows={usage} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
