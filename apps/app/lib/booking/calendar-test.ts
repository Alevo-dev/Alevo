/**
 * Pure helpers for Integrations → Google Calendar / Microsoft 365 → "Test
 * connection" (the I/O is `testCalendar` in the integrations actions). Tested.
 */

/** The admin-facing fix for the vendor errors we have actually seen, or null. */
export function calendarTestHint(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("has not been used in project") || m.includes("calendar api") && m.includes("disabled")) {
    return "Enable the Google Calendar API in the Google Cloud project that owns Alevo's OAuth client, wait a few minutes, then test again.";
  }
  if (m.includes("invalid_grant") || m.includes("expired or revoked") || m.includes("aadsts70000") || m.includes("aadsts700082")) {
    return "The calendar's authorization expired or was revoked. Disconnect, then connect it again.";
  }
  if (m.includes("insufficient") || m.includes("accessdenied") || m.includes("access denied") || m.includes("forbidden")) {
    return "The connected account did not grant calendar access. Disconnect, then connect it again and accept every permission.";
  }
  return null;
}

/** "Reached Google Calendar for admin@example.com: 14 open 30-minute slots in the next 72 hours." */
export function calendarTestDetail(label: string, email: string | null, slots: number, lengthMin: number): string {
  const who = email ? ` for ${email}` : "";
  const open = slots === 0 ? "no open" : `${slots} open`;
  return `Reached ${label}${who}: ${open} ${lengthMin}-minute slot${slots === 1 ? "" : "s"} in the next 72 hours.`;
}
