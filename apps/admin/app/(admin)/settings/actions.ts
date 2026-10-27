"use server";

import { revalidatePath } from "next/cache";
import { deletePlatformSecret, getPlatformSecret, recordAudit, setPlatformSecret } from "@alevo/db";
import { requirePlatformAdmin } from "@alevo/auth";

export type SettingsState = { ok?: boolean; error?: string; errors?: { webhook?: string } };

const KEY = "internal_alerts_slack_webhook" as const;

function fail(error: unknown): SettingsState {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

function slackWebhookError(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter a valid URL.";
  }
  if (url.protocol !== "https:") return "URL must start with https://.";
  if (url.hostname !== "hooks.slack.com") return "Must be a Slack incoming webhook URL (hooks.slack.com).";
  return null;
}

/** Store the internal alerts webhook (encrypted, platform-wide). Rule 13: per-field errors. */
export async function saveInternalWebhook(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  try {
    const me = await requirePlatformAdmin();
    const webhook = String(formData.get("webhook") ?? "").trim();
    if (!webhook) return { errors: { webhook: "Paste the webhook URL to save." } };
    const invalid = slackWebhookError(webhook);
    if (invalid) return { errors: { webhook: invalid } };
    await setPlatformSecret(KEY, webhook);
    await recordAudit({ orgId: null, actorUserId: me.id, action: "platform.secret_set", target: KEY });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Post a test line to the saved webhook, so the channel is confirmed before the watch needs it. */
export async function sendTestInternal(_prev: SettingsState, _formData: FormData): Promise<SettingsState> {
  try {
    await requirePlatformAdmin();
    const webhook = await getPlatformSecret(KEY);
    if (!webhook) return { error: "No webhook saved yet." };
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: ":wave: Test from the Alevo admin console — internal alerts land here." }),
    });
    if (!res.ok) return { error: `Slack returned ${res.status}.` };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Remove the webhook: the watch goes silent until a new one is saved. */
export async function clearInternalWebhook(_prev: SettingsState, _formData: FormData): Promise<SettingsState> {
  try {
    const me = await requirePlatformAdmin();
    await deletePlatformSecret(KEY);
    await recordAudit({ orgId: null, actorUserId: me.id, action: "platform.secret_cleared", target: KEY });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
