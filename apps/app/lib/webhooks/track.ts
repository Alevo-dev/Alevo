import { after } from "next/server";
import { recordWebhookDelivery, type WebhookProvider } from "@alevo/db";

/** Handed to a webhook handler so it can attribute the delivery to an org. */
export type DeliveryTracker = {
  /** Once the org is known. Failures before this are logged without an org. */
  setOrg: (orgId: string) => void;
  /** For handlers that acknowledge with 200 but failed internally. */
  markFailed: () => void;
};

/**
 * Wraps a provider webhook route so each delivery's outcome is logged to
 * webhook_deliveries. The write runs after the response is sent (`after`), so
 * it adds no latency to the webhook, and it never fails the webhook itself.
 * A status of 400+ or a thrown error counts as failed.
 */
export function trackDeliveries(
  provider: WebhookProvider,
  handler: (req: Request, track: DeliveryTracker) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    let orgId: string | null = null;
    let failed = false;
    const track: DeliveryTracker = {
      setOrg: (id) => {
        orgId = id;
      },
      markFailed: () => {
        failed = true;
      },
    };
    try {
      const res = await handler(req, track);
      const outcome = failed || res.status >= 400 ? "failed" : "ok";
      after(() => recordWebhookDelivery({ orgId, provider, outcome }));
      return res;
    } catch (err) {
      after(() => recordWebhookDelivery({ orgId, provider, outcome: "failed" }));
      throw err;
    }
  };
}
