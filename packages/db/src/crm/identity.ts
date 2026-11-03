/**
 * One spelling per identity so the same person matches across the form, SMS,
 * voice and chat. Emails: trimmed, lower-cased. Phones: `+` and digits only;
 * a bare 10-digit number is North American (+1), an 11-digit number starting
 * with 1 gets its `+`; anything else is kept as cleaned (a +44 number stays
 * +44). Blank or digit-less input is null.
 */
export function normalizeEmail(v: string | null | undefined): string | null {
  const e = v?.trim().toLowerCase();
  return e ? e : null;
}

export function normalizePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const cleaned = v.replace(/[^0-9+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return null;
  if (!cleaned.startsWith("+")) {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return digits;
  }
  return `+${digits}`;
}
