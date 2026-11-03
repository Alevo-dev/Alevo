import type { BusyInterval } from "./slots";

type FreeBusyJson = {
  calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { domain?: string; reason?: string }[] }>;
};

/**
 * Busy intervals from a Google free/busy answer. Google replies 200 even when a
 * calendar can't be read and puts the reason under `calendars[id].errors` with no
 * `busy` — which must NOT read as "wide open". Throws so the agent hands off
 * instead of offering times nobody looked at.
 */
export function busyFromFreeBusy(json: FreeBusyJson, calendarId: string): BusyInterval[] {
  const cal = json.calendars?.[calendarId];
  if (!cal) throw new Error(`Google free/busy gave no answer for calendar "${calendarId}"`);
  if (cal.errors?.length) {
    const reasons = cal.errors.map((e) => e.reason ?? e.domain ?? "error").join(", ");
    throw new Error(`Google free/busy could not read calendar "${calendarId}": ${reasons}`);
  }
  return (cal.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}
