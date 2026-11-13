import { webhookDeliveries } from "./schema/webhook-deliveries";
import { withService } from "./with-tenant";

/** Every service an org connects; each gets its own line in Connection health. */
export const CONNECTION_PROVIDERS = ["resend", "twilio", "calcom", "calendly", "vapi", "slack", "connectwise", "google", "microsoft"] as const;
export type WebhookProvider = (typeof CONNECTION_PROVIDERS)[number];
export type DeliveryDirection = "inbound" | "outbound";
export type WebhookOutcome = "ok" | "failed";

/**
 * Log one webhook we received or API call we made. Best-effort: a logging failure must never fail the
 * webhook it describes, so errors are swallowed (and logged to the console).
 * Server-only (service path).
 */
export async function recordWebhookDelivery(entry: {
  orgId: string | null;
  provider: WebhookProvider;
  outcome: WebhookOutcome;
  /** Defaults to a webhook we received. */
  direction?: DeliveryDirection;
}): Promise<void> {
  try {
    await withService((tx) =>
      tx.insert(webhookDeliveries).values({
        orgId: entry.orgId,
        provider: entry.provider,
        outcome: entry.outcome,
        direction: entry.direction ?? "inbound",
      }),
    );
  } catch (error) {
    console.error("recordWebhookDelivery failed:", error);
  }
}
