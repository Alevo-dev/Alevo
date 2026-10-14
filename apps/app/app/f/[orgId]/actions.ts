"use server";

import { and, eq, sql } from "drizzle-orm";
import {
  consents,
  contacts,
  conversations,
  messages,
  organizations,
  recordUsage,
  withService,
} from "@alevo/db";
import { inngest } from "@/lib/inngest/client";
import { isValidTimeZone } from "@/lib/cadence/send-window";

export type LeadValues = {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  consent: boolean;
};
/** Per-field validation errors (shown under each field). */
export type LeadErrors = { name?: string; email?: string; consent?: string };
export type LeadState = {
  ok?: boolean;
  error?: string; // form-level (non-field) error
  errors?: LeadErrors;
  values?: LeadValues;
};

const CONSENT_TEXT = "I agree to be contacted about my inquiry.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public lead capture (no session). Writes via the service path, scoped to the
 * org in the URL. Creates/updates the contact, opens a conversation, records the
 * first inbound message + a consent record, and meters the conversation.
 */
export async function submitLead(
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const orgId = String(formData.get("orgId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw.toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const consented = Boolean(formData.get("consent"));
  const tzRaw = String(formData.get("timezone") ?? "").trim();
  const timezone = isValidTimeZone(tzRaw) ? tzRaw : null;
  // Echoed back so the form keeps its values on error (plan.md rule 13).
  const values: LeadValues = { name, email: emailRaw, phone, company, message, consent: consented };

  const errors: LeadErrors = {};
  if (!name) errors.name = "Name is required.";
  if (!emailRaw) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(emailRaw)) errors.email = "Enter a valid email address.";
  if (!consented) errors.consent = "Please confirm you agree to be contacted.";
  if (Object.keys(errors).length > 0) return { errors, values };

  try {
    if (!orgId) return { error: "This form is not available.", values };

    const [org] = await withService((tx) =>
      tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
    );
    if (!org) return { error: "This form is not available.", values };

    const [firstName, ...restName] = name.split(/\s+/);
    const lastName = restName.length ? restName.join(" ") : null;

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
            phone: phone || null,
            firstName: firstName ?? null,
            lastName,
            company: company || null,
            // Only set tz when we captured one — don't clobber a known value.
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
            phone: phone || null,
            firstName: firstName ?? null,
            lastName,
            company: company || null,
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
        body: message || "(no message)",
      });

      await tx.insert(consents).values({
        orgId,
        contactId,
        channel: "form",
        basis: "form_submission",
        verbatim: CONSENT_TEXT,
        source: "hosted_form",
      });

      return conversation.id;
    });

    await recordUsage(orgId, "inbound_conversations");

    // Hand the new lead to the Qualifier. Emitting the event is a side effect —
    // a send failure must never fail the submission the contact just made.
    try {
      await inngest.send({
        name: "conversation/message.received",
        data: { orgId, conversationId },
      });
    } catch {
      // swallow — the lead is captured; qualification can be retried later
    }
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong", values };
  }
}
