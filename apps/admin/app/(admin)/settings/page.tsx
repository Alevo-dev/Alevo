import type { Metadata } from "next";
import { getPlatformSecret, platformSecretStatus } from "@alevo/db";
import { Card, CardHeader } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { fmtWhen } from "@/lib/metrics-format";
import { ChatModelForm } from "./chat-model-form";
import { FastCadenceForm } from "./fast-cadence-form";
import { InternalAlertsForm } from "./internal-alerts-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

/** Platform-level settings: Alevo's own credentials, stored encrypted, never shown again. */
export default async function SettingsPage() {
  const webhook = await platformSecretStatus("internal_alerts_slack_webhook");
  const fastCadence = (await getPlatformSecret("cadence_fast")) === "1";
  const chatgpt = (await getPlatformSecret("web_chat_model")) === "chatgpt";

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Platform-wide settings for Alevo itself, not for any one workspace." />
      <Card className="max-w-2xl">
        <CardHeader
          title="Internal alerts"
          hint="Where Alevo's own signals go: the daily speed-to-lead digest (orgs whose p95 first reply missed 60 seconds) and the Support reports people send from the app's top bar."
        />
        <div className="mt-6">
          <InternalAlertsForm isSet={webhook.isSet} savedAt={webhook.updatedAt ? fmtWhen(webhook.updatedAt) : null} />
        </div>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader title="Web chat model" hint="Which AI answers the chat widget on customers' websites. Email, texts, forms and phone calls always use Claude." />
        <div className="mt-6">
          <ChatModelForm initial={chatgpt} />
        </div>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader title="Testing" hint="Switches for trying the agent's timing without waiting. Off by default." />
        <div className="mt-6">
          <FastCadenceForm initial={fastCadence} />
        </div>
      </Card>
    </div>
  );
}
