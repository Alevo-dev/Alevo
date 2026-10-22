import { webhookDeliveries } from "./schema/webhook-deliveries";
import { withService } from "./with-tenant";

export type WebhookProvider = "resend" | "twilio" | "calcom" | "calendly";
export type WebhookOutcome = "ok" | "failed";

/**
 * Log one webhook delivery. Best-effort: a logging failure must never fail the
 * webhook it describes, so errors are swallowed (and logged to the console).
 * Server-only (service path).
 */
export async function recordWebhookDelivery(entry: {
  orgId: string | null;
  provider: WebhookProvider;
  outcome: WebhookOutcome;
}): Promise<void> {
  try {
    await withService((tx) =>
      tx.insert(webhookDeliveries).values({
        orgId: entry.orgId,
        provider: entry.provider,
        outcome: entry.outcome,
      }),
    );
  } catch (error) {
    console.error("recordWebhookDelivery failed:", error);
  }
}
