import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { loadPlan } from "@/lib/plan-card";
import { PRICING_URL } from "@/lib/usage/levels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Preferences" };

// Not /settings: that path is a permanent redirect to /workspace (next.config.ts), cached by browsers.
/** Personal and account-level settings: how the app looks, and the plan the workspace is on. */
export default async function PreferencesPage() {
  const { orgId } = await auth();
  const plan = orgId ? await loadPlan() : null;

  return (
    <div className="max-w-[760px] space-y-3.5">
      <PageHeader title="Preferences" description="How Alevo looks, and your plan." />

      <Card>
        <CardHeader title="Appearance" hint="Applies to you on this device." />
        <ThemeToggle />
      </Card>

      {plan && (
        <Card>
          <CardHeader
            title="Plan"
            aside={
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-[550]">
                Compare plans
                <ArrowUpRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              </a>
            }
          />
          <div className="text-[15px] font-semibold text-ink">{plan.name}</div>
          {plan.renews && <div className="mt-1 text-label text-ink-muted">Renews {plan.renews}</div>}
        </Card>
      )}
    </div>
  );
}
