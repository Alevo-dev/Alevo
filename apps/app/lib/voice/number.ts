import { normalizePhone } from "@alevo/db";

/**
 * Does a call to `dialled` belong to the org whose saved number is `saved`?
 * Calls reach an org through the Vapi record on its profile, and that record can
 * outlive the number (it moved to another org, or was cleared), so the webhook
 * checks the number itself. A payload with no number is trusted on the record.
 */
export function numberMatches(saved: string | null, dialled: string | null): boolean {
  const mine = normalizePhone(saved);
  if (!mine) return false;
  const theirs = normalizePhone(dialled);
  return theirs === null || theirs === mine;
}

/** Did saving move the org to a different number (or add / clear one)? */
export function numberChanged(previous: string | null, next: string | null): boolean {
  return normalizePhone(previous) !== normalizePhone(next);
}
