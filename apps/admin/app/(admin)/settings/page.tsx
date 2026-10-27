import type { Metadata } from "next";
import { platformSecretStatus } from "@alevo/db";
import { Card, CardHeader } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { fmtWhen } from "@/lib/metrics-format";
import { InternalAlertsForm } from "./internal-alerts-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/** Platform-level settings: Alevo's own credentials, stored encrypted, never shown again. */
export default async function SettingsPage() {
  const webhook = await platformSecretStatus("internal_alerts_slack_webhook");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Platform-wide settings for Alevo itself, not for any one workspace." />
      <Card className="max-w-2xl">
        <CardHeader
          title="Internal alerts"
          hint="Where Alevo's own signals go: today the daily speed-to-lead digest (orgs whose p95 first reply missed 60 seconds)."
        />
        <div className="mt-6">
          <InternalAlertsForm isSet={webhook.isSet} savedAt={webhook.updatedAt ? fmtWhen(webhook.updatedAt) : null} />
        </div>
      </Card>
    </div>
  );
}
