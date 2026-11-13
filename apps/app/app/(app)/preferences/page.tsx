import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { loadPlan } from "@/lib/plan-card";
import { PRICING_URL } from "@/lib/usage/levels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

// Not /settings: that path is a permanent redirect to /workspace (next.config.ts), cached by browsers.
/** Personal and account-level settings: how the app looks, and the plan the workspace is on. */
export default async function SettingsPage() {
  const { orgId } = await auth();
  const plan = orgId ? await loadPlan() : null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="How Alevo looks, and your plan." />

      <Card>
        <CardHeader title="Appearance" hint="Applies to you on this device." />
        <ThemeToggle className="mt-4" />
      </Card>

      {plan && (
        <Card>
          <CardHeader
            title="Plan"
            aside={
              <a href={PRICING_URL} target="_blank" rel="noopener noreferrer">
                Compare plans
              </a>
            }
          />
          <div className="mt-3 text-sm font-semibold text-ink">{plan.name}</div>
          {plan.renews && <div className="mt-1 text-label text-ink-muted">Renews {plan.renews}</div>}
        </Card>
      )}
    </div>
  );
}
