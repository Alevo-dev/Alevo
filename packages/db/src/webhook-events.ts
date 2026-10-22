import { and, eq } from "drizzle-orm";
import { webhookEvents } from "./schema/identity";
import { withService } from "./with-tenant";

/**
 * Idempotency ledger for inbound webhooks (rule 7). `claim` is first-writer-wins:
 * true means this delivery is new and should be processed; false means a replay.
 * On a processing failure call `release` so the provider's retry is reprocessed.
 * Service path (webhooks have no session).
 */
export async function claimWebhookEvent(provider: string, eventId: string, eventType: string | null): Promise<boolean> {
  const fresh = await withService((tx) =>
    tx
      .insert(webhookEvents)
      .values({ provider, eventId, eventType })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id }),
  );
  return fresh.length > 0;
}

export async function releaseWebhookEvent(provider: string, eventId: string): Promise<void> {
  await withService((tx) =>
    tx.delete(webhookEvents).where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId))),
  );
}
