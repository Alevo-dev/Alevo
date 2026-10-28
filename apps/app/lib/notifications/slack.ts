import "server-only";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { getOrgSecret, orgProfiles, withService } from "@alevo/db";
import { vendorError } from "@/lib/http/vendor-error";
import { vendorFetch } from "@/lib/http/vendor-fetch";

export type SlackResult = { ok: boolean; error?: string };

/**
 * Post a message to an org's configured Slack webhook (stored encrypted in
 * org_secrets). Best-effort and NEVER throws — a notification failure must not
 * break the calling flow. Callers that care (e.g. a test button) can read the
 * result; real flows can fire-and-forget. The outcome is kept on the org
 * profile for the Integrations card: a failure makes it "Needs attention" with
 * Slack's reason ("Slack failed (403): invalid_token"); the first success after
 * a webhook is saved makes it "Connected" (until then it reads "Untested").
 */
export async function notifySlack(orgId: string, text: string): Promise<SlackResult> {
  const webhook = await getOrgSecret(orgId, "slack_webhook_url");
  if (!webhook) return { ok: false, error: "No Slack webhook configured for this org." };
  try {
    const res = await vendorFetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return rememberSlackError(orgId, (await vendorError(res, "Slack")).message);
    await markSlackWorking(orgId);
    return { ok: true };
  } catch (error) {
    return rememberSlackError(orgId, error instanceof Error ? error.message : "Network error");
  }
}

async function rememberSlackError(orgId: string, error: string): Promise<SlackResult> {
  await withService((tx) =>
    tx.update(orgProfiles).set({ slackLastError: error, slackLastErrorAt: new Date() }).where(eq(orgProfiles.orgId, orgId)),
  ).catch(() => undefined);
  return { ok: false, error };
}

/** A post went through: verified, and any earlier failure forgotten. One write, only when something changes. */
async function markSlackWorking(orgId: string): Promise<void> {
  await withService((tx) =>
    tx
      .update(orgProfiles)
      .set({ slackLastError: null, slackLastErrorAt: null, slackVerifiedAt: new Date() })
      .where(and(eq(orgProfiles.orgId, orgId), or(isNotNull(orgProfiles.slackLastError), isNull(orgProfiles.slackVerifiedAt)))),
  ).catch(() => undefined);
}

/** The webhook was saved or removed: back to "Untested", nothing known about it yet. */
export async function resetSlackHealth(orgId: string): Promise<void> {
  await withService((tx) =>
    tx.update(orgProfiles).set({ slackLastError: null, slackLastErrorAt: null, slackVerifiedAt: null }).where(eq(orgProfiles.orgId, orgId)),
  ).catch(() => undefined);
}
