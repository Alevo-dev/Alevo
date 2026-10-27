import "server-only";
import * as Sentry from "@sentry/nextjs";
import { inngest } from "@/lib/inngest/client";
import type { WritebackReason } from "./connectwise-map";

/**
 * Ask for a PSA write-back of this conversation. Fired from the places a lead
 * becomes qualified (handed off, or a meeting booked). It only sends an event:
 * the Inngest function checks whether the org has a PSA connected and does the
 * work with retries. Best-effort — a send failure never breaks the caller
 * (the agent's reply, a webhook) and is reported to Sentry instead.
 */
export async function requestPsaWriteback(orgId: string, conversationId: string, reason: WritebackReason): Promise<void> {
  try {
    await inngest.send({ name: "psa/writeback.requested", data: { orgId, conversationId, reason } });
  } catch (err) {
    Sentry.captureException(err);
  }
}
