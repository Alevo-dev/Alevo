import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import {
  conversations,
  getOrgSecret,
  meetings,
  claimWebhookEvent,
  releaseWebhookEvent,
  withService,
} from "@alevo/db";
import { safeEqual } from "@/lib/crypto/safe-equal";
import { trackDeliveries } from "@/lib/webhooks/track";

/**
 * Calendly webhooks (link mode) → record/sync meetings. The scheduling link the
 * Qualifier sends carries `utm_content = conversationId`, which Calendly echoes
 * in `payload.tracking.utm_content`, so we tie the booking to the conversation.
 * Signature: `Calendly-Webhook-Signature: t=…,v1=…`, HMAC-SHA256 of `t.rawBody`
 * with the org's `calendly_webhook_secret` (verified when set; rule 7).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CalendlyPayload = {
  tracking?: { utm_content?: string };
  scheduled_event?: {
    uri?: string;
    start_time?: string;
    end_time?: string;
    location?: { join_url?: string };
  };
};

function verify(raw: string, secret: string, header: string | null): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  // Reject stale deliveries (5-minute tolerance).
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  return safeEqual(v1, createHmac("sha256", secret).update(`${t}.${raw}`, "utf8").digest("hex"));
}

export const POST = trackDeliveries("calendly", async (req, track) => {
  const raw = await req.text();
  let body: { event?: string; payload?: CalendlyPayload };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const event = body.event ?? "";
  if (event !== "invitee.created" && event !== "invitee.canceled") {
    return new Response("ok (ignored)", { status: 200 });
  }
  const p = body.payload ?? {};
  const scheduledUri = p.scheduled_event?.uri ?? null;
  const utm = p.tracking?.utm_content;
  const conversationId = utm && UUID_RE.test(utm) ? utm : null;

  // Resolve org + conversation: via the tracked conversation id, else via a
  // meeting we already recorded for this Calendly event.
  let orgId: string | null = null;
  let contactId: string | null = null;
  let convId: string | null = conversationId;

  if (conversationId) {
    const [conv] = await withService((tx) =>
      tx
        .select({ orgId: conversations.orgId, contactId: conversations.contactId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1),
    );
    if (conv) {
      orgId = conv.orgId;
      contactId = conv.contactId;
    }
  }
  if (!orgId && scheduledUri) {
    const [m] = await withService((tx) =>
      tx
        .select({ orgId: meetings.orgId, conversationId: meetings.conversationId })
        .from(meetings)
        .where(eq(meetings.providerRef, scheduledUri))
        .limit(1),
    );
    if (m) {
      orgId = m.orgId;
      convId = m.conversationId;
    }
  }
  if (!orgId) return new Response("ok (unresolved)", { status: 200 });
  track.setOrg(orgId);

  const secret = await getOrgSecret(orgId, "calendly_webhook_secret").catch(() => null);
  if (secret && !verify(raw, secret, req.headers.get("calendly-webhook-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }

  const dedupeKey = `${event}:${scheduledUri ?? convId ?? ""}`;
  if (!(await claimWebhookEvent("calendly", dedupeKey, event))) return new Response("ok (duplicate)", { status: 200 });

  try {
    if (event === "invitee.canceled") {
      if (scheduledUri) {
        await withService(async (tx) => {
          await tx
            .update(meetings)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(and(eq(meetings.orgId, orgId!), eq(meetings.providerRef, scheduledUri)));
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

    // invitee.created → record the booking + mark the conversation booked.
    const startAt = p.scheduled_event?.start_time ? new Date(p.scheduled_event.start_time) : null;
    const endAt = p.scheduled_event?.end_time ? new Date(p.scheduled_event.end_time) : null;
    await withService(async (tx) => {
      await tx
        .insert(meetings)
        .values({
          orgId: orgId!,
          conversationId: convId,
          contactId,
          provider: "calendly",
          providerRef: scheduledUri,
          status: "scheduled",
          startAt,
          endAt,
          joinUrl: p.scheduled_event?.location?.join_url ?? null,
        })
        .onConflictDoNothing();
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
    await releaseWebhookEvent("calendly", dedupeKey);
    return new Response("processing error", { status: 500 });
  }
});
