import "server-only";
import type { SlackResult } from "@/lib/notifications/slack";

/**
 * Alevo's own alerts channel (not a tenant's): `INTERNAL_ALERTS_SLACK_WEBHOOK`.
 * Used for platform-level signals such as the speed-to-lead watch. Best-effort,
 * never throws; unset in dev means "skipped".
 */
export async function notifyInternal(text: string): Promise<SlackResult> {
  const webhook = process.env.INTERNAL_ALERTS_SLACK_WEBHOOK;
  if (!webhook) return { ok: false, error: "INTERNAL_ALERTS_SLACK_WEBHOOK isn't set." };
  try {
    const res = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    return res.ok ? { ok: true } : { ok: false, error: `Slack returned ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
}
