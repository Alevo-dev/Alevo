import * as Sentry from "@sentry/nextjs";
import { and, eq, sql } from "drizzle-orm";
import { consents, contacts, conversations, hitRateLimit, messages, organizations, withService } from "@alevo/db";
import { inngest } from "@/lib/inngest/client";
import { meterUsage } from "@/lib/usage/limits";
import { isValidTimeZone } from "@/lib/cadence/send-window";
import { type LeadErrors, type LeadFields, validateLead } from "./fields";
import { clientIp, FORM_LIMITS, ipKey, parseStartedAt, spamReason } from "./spam";

export const CONSENT_TEXT = "I agree to be contacted about my inquiry.";

/** Where the submission came from; stored on the consent record. */
export type LeadSource = "hosted_form" | "embed" | "api";

export { readLeadFields, validateLead, type LeadErrors, type LeadFields, type LeadValues } from "./fields";

export type CaptureResult = { ok: true } | { ok: false; status: 400; errors: LeadErrors } | { ok: false; status: 404 | 429 | 500; error: string };

/** Per-IP and per-org brakes. Fails OPEN: a limiter outage must never turn leads away. */
async function withinLimits(orgId: string, headers: Headers): Promise<boolean> {
  try {
    const [ipOk, orgOk] = await Promise.all([
      hitRateLimit(ipKey("lead_form", clientIp(headers)), FORM_LIMITS.ip.limit, FORM_LIMITS.ip.windowSeconds),
      hitRateLimit(`lead_form:org:${orgId}`, FORM_LIMITS.org.limit, FORM_LIMITS.org.windowSeconds),
    ]);
    return ipOk && orgOk;
  } catch (err) {
    Sentry.captureException(err);
    return true;
  }
}

/**
 * Public lead capture (no session). Validates, applies the spam checks and
 * rate limits, then, via the service path scoped to the org, creates or
 * updates the contact, opens a conversation with the first inbound message and
 * a consent record, meters the conversation and hands it to the Qualifier.
 * Spam is answered with `ok: true` and dropped.
 */
export async function captureLead(
  orgId: string,
  fields: LeadFields,
  meta: { source: LeadSource; headers: Headers; now?: number },
): Promise<CaptureResult> {
  const errors = validateLead(fields);
  if (Object.keys(errors).length > 0) return { ok: false, status: 400, errors };
  if (!orgId) return { ok: false, status: 404, error: "This form is not available." };

  const now = meta.now ?? Date.now();
  if (
    spamReason({
      honeypot: fields.honeypot,
      startedAt: parseStartedAt(fields.startedAt, now),
      now,
    })
  )
    return { ok: true };

  try {
    if (!(await withinLimits(orgId, meta.headers))) {
      return { ok: false, status: 429, error: "Too many submissions. Please try again in a few minutes." };
    }

    const [org] = await withService((tx) => tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1));
    if (!org) return { ok: false, status: 404, error: "This form is not available." };

    const email = fields.email.toLowerCase();
    const timezone = isValidTimeZone(fields.timezone) ? fields.timezone : null;
    const [firstName, ...restName] = fields.name.split(/\s+/);
    const lastName = restName.length ? restName.join(" ") : null;
    const phone = fields.phone || null;
    const company = fields.company || null;

    const conversationId = await withService(async (tx) => {
      const [existing] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), sql`lower(${contacts.email}) = ${email}`))
        .limit(1);

      let contactId: string;
      if (existing) {
        await tx
          .update(contacts)
          .set({
            phone,
            firstName: firstName ?? null,
            lastName,
            company,
            // Only set tz when we captured one; never clobber a known value.
            ...(timezone ? { timezone } : {}),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing.id));
        contactId = existing.id;
      } else {
        const [created] = await tx
          .insert(contacts)
          .values({
            orgId,
            email,
            phone,
            firstName: firstName ?? null,
            lastName,
            company,
            timezone,
            source: "form",
          })
          .returning({ id: contacts.id });
        if (!created) throw new Error("Failed to create contact");
        contactId = created.id;
      }

      const [conversation] = await tx
        .insert(conversations)
        .values({ orgId, contactId, channel: "form", status: "new" })
        .returning({ id: conversations.id });
      if (!conversation) throw new Error("Failed to create conversation");

      await tx.insert(messages).values({
        orgId,
        conversationId: conversation.id,
        direction: "inbound",
        author: "contact",
        channel: "form",
        body: fields.message || "(no message)",
      });

      await tx.insert(consents).values({
        orgId,
        contactId,
        channel: "form",
        basis: "form_submission",
        verbatim: CONSENT_TEXT,
        source: meta.source,
      });

      return conversation.id;
    });

    await meterUsage(orgId, "inbound_conversations");

    // Hand the new lead to the Qualifier. Emitting the event is a side effect:
    // a send failure must never fail the submission the contact just made.
    try {
      await inngest.send({
        name: "conversation/message.received",
        data: { orgId, conversationId },
      });
    } catch {
      // swallow: the lead is captured; qualification can be retried later
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
