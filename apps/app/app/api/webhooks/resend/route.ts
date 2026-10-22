import { eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import {
  addSuppression,
  contacts,
  conversations,
  messages,
  recordConsent,
  revokeConsentForEmail,
  claimWebhookEvent,
  releaseWebhookEvent,
  withService,
} from "@alevo/db";
import { inngest } from "@/lib/inngest/client";
import { verifyResendWebhook, type ResendWebhookEvent } from "@/lib/webhooks/verify";
import { fetchReceivedEmail, findConversationId } from "@/lib/email/resend";
import { trackDeliveries, type DeliveryTracker } from "@/lib/webhooks/track";

/** Read a value from Resend `tags` (array of {name,value} or a plain object). */
function tagValue(tags: unknown, name: string): string | null {
  if (Array.isArray(tags)) {
    const t = tags.find(
      (x): x is { name: string; value: string } =>
        !!x && typeof x === "object" && (x as { name?: unknown }).name === name,
    );
    return t ? String(t.value) : null;
  }
  if (tags && typeof tags === "object") {
    const v = (tags as Record<string, unknown>)[name];
    return v == null ? null : String(v);
  }
  return null;
}

/** When tags don't carry org_id, fall back to a unique contact match by email. */
async function resolveOrgByEmail(email: string): Promise<string | null> {
  const rows = await withService((tx) =>
    tx
      .selectDistinct({ orgId: contacts.orgId })
      .from(contacts)
      .where(sql`lower(${contacts.email}) = ${email.toLowerCase()}`)
      .limit(2),
  );
  return rows.length === 1 ? (rows[0]?.orgId ?? null) : null;
}

/**
 * Bounce / spam complaint → add the recipient to the org's suppression list so
 * the Qualifier stops emailing them (compliance). Best-effort; idempotent.
 */
async function handleSuppression(event: ResendWebhookEvent, track: DeliveryTracker): Promise<Response> {
  const data = event.data as { to?: string[] | string; tags?: unknown };
  const toList = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
  const email = (toList[0] ?? "").toString().trim();
  if (!email) return new Response("ok (no recipient)", { status: 200 });

  const orgId = tagValue(data.tags, "org_id") ?? (await resolveOrgByEmail(email));
  if (!orgId) return new Response("ok (org unresolved)", { status: 200 });
  track.setOrg(orgId);

  const reason = event.type === "email.complained" ? "complaint" : "bounce";
  await addSuppression(orgId, email, reason).catch((err) => Sentry.captureException(err));
  await revokeConsentForEmail(orgId, email).catch((err) => Sentry.captureException(err));
  return new Response("ok (suppressed)", { status: 200 });
}

/**
 * Inbound email from Resend (`email.received`). A lead's reply arrives at the
 * per-conversation Reply-To (`reply+<conversationId>@<inbound-domain>`); we match
 * it back to the conversation, record it as an inbound message, and hand it to
 * the Qualifier — the same event the hosted form and the tester fire.
 *
 * The webhook is metadata-only (rule 7: svix-verified, idempotent on the
 * received email id); the body is fetched separately by id.
 */
export const POST = trackDeliveries("resend", async (req, track) => {
  let verified: Awaited<ReturnType<typeof verifyResendWebhook>>;
  try {
    verified = await verifyResendWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const { event } = verified;

  if (event.type === "email.bounced" || event.type === "email.complained") {
    return handleSuppression(event, track);
  }
  if (event.type !== "email.received") {
    return new Response("ok (ignored)", { status: 200 });
  }

  const data = event.data as {
    email_id?: string;
    to?: string[] | string;
    received_for?: string[] | string;
    message_id?: string;
  };
  const emailId = data.email_id;
  if (!emailId) return new Response("ok (no email id)", { status: 200 });

  // Idempotency: first writer wins (Resend/svix retries are a no-op).
  if (!(await claimWebhookEvent("resend", emailId, event.type))) return new Response("ok (duplicate)", { status: 200 });

  try {
    // Which conversation is this a reply to?
    const toList = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
    const forList = Array.isArray(data.received_for)
      ? data.received_for
      : data.received_for
        ? [data.received_for]
        : [];
    const conversationId = findConversationId([...toList, ...forList]);
    if (!conversationId) return new Response("ok (unmatched)", { status: 200 });

    // Resolve the org + contact from the (unguessable) conversation id.
    const [conv] = await withService((tx) =>
      tx
        .select({ orgId: conversations.orgId, contactId: conversations.contactId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1),
    );
    if (!conv) return new Response("ok (no conversation)", { status: 200 });
    track.setOrg(conv.orgId);

    // The webhook has no body — fetch the full content by id.
    const content = await fetchReceivedEmail(emailId);
    const body = (content?.text ?? content?.html ?? "").trim() || "(empty email)";

    const inserted = await withService((tx) =>
      tx
        .insert(messages)
        .values({
          orgId: conv.orgId,
          conversationId,
          direction: "inbound",
          author: "contact",
          channel: "email",
          body,
          providerRef: data.message_id ?? emailId,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id }),
    );
    // Same email delivered twice (providerRef dupe) → don't re-trigger the agent.
    if (inserted.length === 0) return new Response("ok (duplicate message)", { status: 200 });

    // Independent side effects, run together: consent on the email channel
    // (idempotent) and the hand-off to the Qualifier. Neither may fail the
    // webhook — the message is already recorded (Resend would retry otherwise).
    await Promise.all([
      recordConsent(conv.orgId, conv.contactId, "email", "inbound_reply", { source: "email" }).catch((e) =>
        Sentry.captureException(e),
      ),
      inngest
        .send({ name: "conversation/message.received", data: { orgId: conv.orgId, conversationId } })
        .catch((e) => Sentry.captureException(e)),
    ]);

    return new Response("ok", { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    // Drop the idempotency row so Resend's retry reprocesses.
    await releaseWebhookEvent("resend", emailId);
    return new Response("Processing error", { status: 500 });
  }
});
