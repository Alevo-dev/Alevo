import "server-only";
import { getPlatformSecret } from "@alevo/db";
import type { SlackResult } from "@/lib/notifications/slack";
import { vendorFetch } from "@/lib/http/vendor-fetch";

/**
 * Alevo's own alerts channel (not a tenant's): the Slack webhook saved under
 * Admin console → Settings → Internal alerts (platform_secrets, encrypted).
 * Used for platform-level signals such as the speed-to-lead watch. Best-effort,
 * never throws; nothing saved means "skipped".
 */
export async function notifyInternal(text: string): Promise<SlackResult> {
  const webhook = await getPlatformSecret("internal_alerts_slack_webhook");
  if (!webhook) return { ok: false, error: "No internal alerts webhook saved (Admin → Settings)." };
  try {
    const res = await vendorFetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    return res.ok ? { ok: true } : { ok: false, error: `Slack returned ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
}
