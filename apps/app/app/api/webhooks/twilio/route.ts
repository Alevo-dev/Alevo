import { and, desc, eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import {
  contacts,
  conversations,
  messages,
  orgProfiles,
  recordConsent,
  recordUsage,
  revokeConsentForContact,
  withService,
} from "@alevo/db";
import { inngest } from "@/lib/inngest/client";
import { isOptOutMessage, verifyTwilioSignature } from "@/lib/sms/twilio";
import { trackDeliveries } from "@/lib/webhooks/track";

/** Empty TwiML — we reply asynchronously via the API, not in this response. */
function twiml() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "content-type": "text/xml" },
  });
}

/**
 * Inbound SMS from Twilio (form-encoded). Routed to the org by the `To` number
 * (org_profiles.sms_from_number); the contact is matched/created by `From`
 * phone. Records an inbound `sms` message and fires `conversation/message.received`
 * — the same event the form / email / tester fire. Signature-verified (rule 7).
 */
export const POST = trackDeliveries("twilio", async (req, track) => {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;

  // Twilio signs the exact public URL it called — rebuild it from forwarded
  // headers (ngrok / Vercel), not req.url (which may be an internal host).
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const url = `${proto}://${host}${new URL(req.url).pathname}`;
  if (!verifyTwilioSignature(url, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature", { status: 403 });
  }

  const fromPhone = (params.From ?? "").trim();
  const toNumber = (params.To ?? "").trim();
  const body = (params.Body ?? "").trim();
  const messageSid = (params.MessageSid ?? params.SmsSid ?? "").trim() || null;
  if (!fromPhone || !toNumber) return twiml();

  try {
    // Resolve the org by the Twilio number that was texted.
    const [org] = await withService((tx) =>
      tx
        .select({ orgId: orgProfiles.orgId })
        .from(orgProfiles)
        .where(eq(orgProfiles.smsFromNumber, toNumber))
        .limit(1),
    );
    if (!org) return twiml(); // unknown number — ack and ignore
    const orgId = org.orgId;
    track.setOrg(orgId);

    // Carrier opt-out: Twilio blocks future sends; we don't engage, and we
    // revoke the contact's SMS consent.
    if (isOptOutMessage(body)) {
      const [c] = await withService((tx) =>
        tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.orgId, orgId), eq(contacts.phone, fromPhone)))
          .limit(1),
      );
      if (c) await revokeConsentForContact(orgId, c.id, "sms").catch((e) => Sentry.captureException(e));
      return twiml();
    }

    const result = await withService(async (tx) => {
      const [existing] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.phone, fromPhone)))
        .limit(1);
      let contactId = existing?.id;
      if (!contactId) {
        const [c] = await tx
          .insert(contacts)
          .values({ orgId, phone: fromPhone, source: "sms" })
          .returning({ id: contacts.id });
        contactId = c?.id;
      }
      if (!contactId) throw new Error("Failed to resolve contact");

      const [open] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.orgId, orgId),
            eq(conversations.contactId, contactId),
            eq(conversations.channel, "sms"),
            sql`${conversations.status} not in ('closed','disqualified','booked')`,
          ),
        )
        .orderBy(desc(conversations.createdAt))
        .limit(1);

      let conversationId = open?.id;
      let createdConversation = false;
      if (!conversationId) {
        const [conv] = await tx
          .insert(conversations)
          .values({ orgId, contactId, channel: "sms", status: "new" })
          .returning({ id: conversations.id });
        conversationId = conv?.id;
        createdConversation = true;
      }
      if (!conversationId) throw new Error("Failed to resolve conversation");

      const inserted = await tx
        .insert(messages)
        .values({
          orgId,
          conversationId,
          direction: "inbound",
          author: "contact",
          channel: "sms",
          body: body || "(empty)",
          providerRef: messageSid,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });

      return { conversationId, contactId, createdConversation, isNewMessage: inserted.length > 0 };
    });

    // Meter a brand-new SMS conversation (parity with the hosted form, rule 11).
    if (result.createdConversation) await recordUsage(orgId, "inbound_conversations");

    // The contact texted in → consent on the SMS channel (idempotent).
    if (result.isNewMessage) {
      await recordConsent(orgId, result.contactId, "sms", "inbound_message", {
        source: "sms",
      }).catch((e) => Sentry.captureException(e));
    }

    // Only hand to the Qualifier when we actually recorded a new message.
    if (result.isNewMessage) {
      try {
        await inngest.send({
          name: "conversation/message.received",
          data: { orgId, conversationId: result.conversationId },
        });
      } catch (sendError) {
        Sentry.captureException(sendError);
      }
    }
    return twiml();
  } catch (err) {
    Sentry.captureException(err);
    track.markFailed(); // acknowledged so Twilio does not retry, but counted as failed
    return twiml(); // ack so Twilio doesn't retry-storm; the error is logged
  }
});
