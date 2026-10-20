import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

export type FieldErrors = Record<string, string | undefined>;
export type FormErrors = { fields: FieldErrors; form?: string };

/** Clerk `meta.paramName` → our field names. Anything else is form-level. */
const PARAM_TO_FIELD: Record<string, string> = {
  identifier: "email",
  email_address: "email",
  password: "password",
  first_name: "name",
  last_name: "name",
  code: "code",
};

/** Turn a thrown Clerk error into per-field + form-level messages (rule 13). */
export function toFormErrors(err: unknown): FormErrors {
  if (isClerkAPIResponseError(err)) {
    const out: FormErrors = { fields: {} };
    for (const e of err.errors) {
      const field = e.meta?.paramName ? PARAM_TO_FIELD[e.meta.paramName] : undefined;
      const message = e.longMessage ?? e.message;
      if (field && !out.fields[field]) out.fields[field] = message;
      else if (!out.form) out.form = message;
    }
    return out;
  }
  return { fields: {}, form: err instanceof Error ? err.message : "Something went wrong. Try again." };
}
