import "server-only";
import { getOrgSecret } from "@alevo/db";

export type SlackResult = { ok: boolean; error?: string };

/**
 * Post a message to an org's configured Slack webhook (stored encrypted in
 * org_secrets). Best-effort and NEVER throws — a notification failure must not
 * break the calling flow. Callers that care (e.g. a test button) can read the
 * result; real flows can fire-and-forget.
 */
export async function notifySlack(orgId: string, text: string): Promise<SlackResult> {
  const webhook = await getOrgSecret(orgId, "slack_webhook_url");
  if (!webhook) return { ok: false, error: "No Slack webhook configured for this org." };
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return { ok: false, error: `Slack returned ${res.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
}
