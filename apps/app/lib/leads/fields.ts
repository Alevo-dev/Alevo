import { HONEYPOT_FIELD } from "./spam";

/** The lead form's fields and validation, pure so the API, the hosted form and the tests share one definition. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = {
  name: 200,
  email: 320,
  phone: 40,
  company: 200,
  message: 5000,
} as const;

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

export type LeadFields = LeadValues & {
  honeypot: string;
  startedAt: string;
  timezone: string;
};

/** Pull the lead fields out of a FormData or a parsed JSON body; everything is trimmed, nothing is trusted. */
export function readLeadFields(get: (name: string) => unknown): LeadFields {
  const str = (name: string, max: number) =>
    String(get(name) ?? "")
      .trim()
      .slice(0, max);
  const consentRaw = get("consent");
  return {
    name: str("name", MAX.name),
    email: str("email", MAX.email),
    phone: str("phone", MAX.phone),
    company: str("company", MAX.company),
    message: str("message", MAX.message),
    consent: consentRaw === true || consentRaw === "true" || consentRaw === "yes" || consentRaw === "on" || consentRaw === "1",
    honeypot: str(HONEYPOT_FIELD, 500),
    startedAt: str("startedAt", 20),
    timezone: str("timezone", 64),
  };
}

export function validateLead(v: LeadValues): LeadErrors {
  const errors: LeadErrors = {};
  if (!v.name) errors.name = "Name is required.";
  if (!v.email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(v.email)) errors.email = "Enter a valid email address.";
  if (!v.consent) errors.consent = "Please confirm you agree to be contacted.";
  return errors;
}
