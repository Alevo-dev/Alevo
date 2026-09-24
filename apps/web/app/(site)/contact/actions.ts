"use server";

/**
 * Book-a-demo submission — intentionally backend-agnostic.
 *
 * The database/CRM is not chosen yet, so this validates input and returns a
 * result without persisting. Wire the marked TODO to your backend later
 * (email, CRM, queue, DB — whatever we land on).
 */

export type ContactState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<"name" | "email" | "company" | "message", string>>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitDemoRequest(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const errors: ContactState["errors"] = {};
  if (name.length < 2) errors.name = "Please tell us your name.";
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid work email.";
  if (company.length < 2) errors.company = "What company are you with?";
  if (message.length < 10)
    errors.message = "A sentence or two about your use case helps.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // TODO(backend): persist / notify once the datastore + CRM are decided.
  // e.g. await db.demoRequests.create({ name, email, company, message })
  //      or forward to an email/CRM webhook.

  return {
    ok: true,
    message: "Thanks — we'll be in touch within one business day.",
  };
}
