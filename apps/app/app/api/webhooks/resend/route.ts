import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { conversations, messages, webhookEvents, withService } from "@alevo/db";
import { inngest } from "@/lib/inngest/client";
import { verifyResendWebhook } from "@/lib/webhooks/verify";
import { fetchReceivedEmail, findConversationId } from "@/lib/email/resend";

/**
 * Inbound email from Resend (`email.received`). A lead's reply arrives at the
 * per-conversation Reply-To (`reply+<conversationId>@<inbound-domain>`); we match
 * it back to the conversation, record it as an inbound message, and hand it to
 * the Qualifier — the same event the hosted form and the tester fire.
 *
 * The webhook is metadata-only (rule 7: svix-verified, idempotent on the
 * received email id); the body is fetched separately by id.
 */
export async function POST(req: Request) {
  let verified: Awaited<ReturnType<typeof verifyResendWebhook>>;
  try {
    verified = await verifyResendWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const { event } = verified;

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
  const fresh = await withService((tx) =>
    tx
      .insert(webhookEvents)
      .values({ provider: "resend", eventId: emailId, eventType: event.type })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id }),
  );
  if (fresh.length === 0) return new Response("ok (duplicate)", { status: 200 });

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

    // Resolve the org from the (unguessable) conversation id — service path.
    const [conv] = await withService((tx) =>
      tx
        .select({ orgId: conversations.orgId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1),
    );
    if (!conv) return new Response("ok (no conversation)", { status: 200 });

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

    // Hand to the Qualifier. Side effect — a send failure must not fail the
    // webhook (the message is already recorded; Resend would retry otherwise).
    try {
      await inngest.send({
        name: "conversation/message.received",
        data: { orgId: conv.orgId, conversationId },
      });
    } catch (sendError) {
      Sentry.captureException(sendError);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    Sentry.captureException(err);
    // Drop the idempotency row so Resend's retry reprocesses.
    await withService((tx) =>
      tx
        .delete(webhookEvents)
        .where(and(eq(webhookEvents.provider, "resend"), eq(webhookEvents.eventId, emailId))),
    );
    return new Response("Processing error", { status: 500 });
  }
}
