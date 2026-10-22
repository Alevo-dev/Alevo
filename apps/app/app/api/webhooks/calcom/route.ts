import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import {
  conversations,
  getOrgSecret,
  meetings,
  webhookEvents,
  withService,
  type MeetingStatus,
} from "@alevo/db";
import { trackDeliveries } from "@/lib/webhooks/track";

/**
 * Cal.com booking webhooks → keep `meetings` + conversation status in sync.
 * We set `metadata.alevoOrgId` / `alevoConversationId` when booking, so Alevo
 * bookings resolve directly; others fall back to matching the stored booking
 * uid. Signature: `x-cal-signature-256` = HMAC-SHA256(secret, raw body), using
 * the org's `calcom_webhook_secret` (rule 7). Idempotent per (event, uid).
 */
type CalPayload = {
  uid?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  metadata?: { alevoOrgId?: string; alevoConversationId?: string };
};

function verify(raw: string, secret: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST = trackDeliveries("calcom", async (req, track) => {
  const raw = await req.text();
  let event: { triggerEvent?: string; payload?: CalPayload };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const trigger = event.triggerEvent ?? "";
  const payload = event.payload ?? {};
  const uid = payload.uid;
  if (!uid) return new Response("ok (no uid)", { status: 200 });

  // Resolve the org: metadata first, else the meeting we recorded at booking.
  let orgId = payload.metadata?.alevoOrgId ?? null;
  const rows = await withService((tx) => {
    const sel = tx
      .select({ id: meetings.id, conversationId: meetings.conversationId, orgId: meetings.orgId })
      .from(meetings);
    return orgId
      ? sel.where(and(eq(meetings.orgId, orgId), eq(meetings.providerRef, uid))).limit(1)
      : sel.where(eq(meetings.providerRef, uid)).limit(1);
  });
  const existing = rows[0];
  if (!orgId && existing) orgId = existing.orgId;
  if (!orgId) return new Response("ok (org unresolved)", { status: 200 });
  track.setOrg(orgId);

  // Verify signature when a secret is configured (else proceed, best-effort MVP).
  const secret = await getOrgSecret(orgId, "calcom_webhook_secret").catch(() => null);
  if (secret && !verify(raw, secret, req.headers.get("x-cal-signature-256"))) {
    return new Response("invalid signature", { status: 401 });
  }

  // Idempotency per (event, booking).
  const fresh = await withService((tx) =>
    tx
      .insert(webhookEvents)
      .values({ provider: "calcom", eventId: `${trigger}:${uid}`, eventType: trigger })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id }),
  );
  if (fresh.length === 0) return new Response("ok (duplicate)", { status: 200 });

  try {
    const convId = payload.metadata?.alevoConversationId ?? existing?.conversationId ?? null;
    const startAt = payload.startTime ? new Date(payload.startTime) : null;
    const endAt = payload.endTime ? new Date(payload.endTime) : null;

    if (trigger === "BOOKING_CANCELLED") {
      if (existing) {
        await withService(async (tx) => {
          await tx
            .update(meetings)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(meetings.id, existing!.id));
          // Reopen the conversation so a human / the Qualifier can follow up.
          if (convId) {
            await tx
              .update(conversations)
              .set({ status: "active", updatedAt: new Date() })
              .where(and(eq(conversations.id, convId), eq(conversations.orgId, orgId!)));
          }
        });
      }
      return new Response("ok", { status: 200 });
    }

    const status: MeetingStatus = trigger === "BOOKING_RESCHEDULED" ? "rescheduled" : "scheduled";

    await withService(async (tx) => {
      if (existing) {
        await tx
          .update(meetings)
          .set({
            status,
            providerRef: uid,
            startAt,
            endAt,
            joinUrl: payload.location ?? null,
            updatedAt: new Date(),
          })
          .where(eq(meetings.id, existing!.id));
      } else if (convId) {
        // A booking we didn't record (e.g. external) but tied to a conversation.
        await tx
          .insert(meetings)
          .values({
            orgId: orgId!,
            conversationId: convId,
            provider: "calcom",
            providerRef: uid,
            status,
            startAt,
            endAt,
            joinUrl: payload.location ?? null,
          })
          .onConflictDoNothing();
      }
      if (convId) {
        await tx
          .update(conversations)
          .set({ status: "booked", updatedAt: new Date() })
          .where(and(eq(conversations.id, convId), eq(conversations.orgId, orgId!)));
      }
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    await withService((tx) =>
      tx
        .delete(webhookEvents)
        .where(and(eq(webhookEvents.provider, "calcom"), eq(webhookEvents.eventId, `${trigger}:${uid}`))),
    );
    return new Response("processing error", { status: 500 });
  }
});
