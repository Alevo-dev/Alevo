"use server";

import { headers } from "next/headers";
import { captureLead, readLeadFields, type LeadErrors, type LeadValues } from "@/lib/leads/capture";

export type { LeadErrors, LeadValues };
export type LeadState = {
  ok?: boolean;
  error?: string; // form-level (non-field) error
  errors?: LeadErrors;
  values?: LeadValues;
};

/** The hosted form's submit: the same capture path as the public API, with the form's values echoed back on error (plan.md rule 13). */
export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const orgId = String(formData.get("orgId") ?? "");
  const fields = readLeadFields((name) => formData.get(name));
  const { honeypot: _h, startedAt: _s, timezone: _t, ...values } = fields;
  const result = await captureLead(orgId, fields, {
    source: "hosted_form",
    headers: await headers(),
  });
  if (result.ok) return { ok: true };
  if (result.status === 400) return { errors: result.errors, values };
  return { error: result.error, values };
}
