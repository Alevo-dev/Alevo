/**
 * Send-window math for the follow-up cadence. Proactive nudges fire only inside
 * a daily window (e.g. 8am–8pm) in the contact's timezone — never at 3am local.
 *
 * Pure `Intl` (no date library): `formatToParts` reads a timezone's wall-clock
 * and offset at any instant, which makes the conversion DST-correct. Immediate
 * replies to a fresh inbound are NOT gated — only cadence nudges call this.
 */

/** Used when neither the contact nor the org has a timezone set. */
export const DEFAULT_TIMEZONE = "America/New_York";

/** True when `tz` is a timezone Intl recognises. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of `date` as seen in `timeZone`. */
function partsInZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Minutes the wall-clock in `timeZone` is ahead of UTC at `date`. */
function offsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUtc - date.getTime()) / 60000;
}

/**
 * The UTC instant for a given wall-clock time in `timeZone`. The zone's offset
 * depends on the instant (DST), so we guess treating the wall-clock as UTC and
 * correct by the offset — iterated twice to settle across a DST boundary.
 */
function zonedWallTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, 0, 0);
  for (let i = 0; i < 2; i++) {
    const off = offsetMinutes(new Date(utc), timeZone);
    utc = Date.UTC(year, month - 1, day, hour, 0, 0) - off * 60000;
  }
  return new Date(utc);
}

/**
 * The next instant at or after `now` inside the daily window
 * `[startHour, endHour)` in `timeZone`. Returns `now` when already inside, or
 * when the window is degenerate (fail open rather than stall the cadence).
 */
export function nextSendTime(
  now: Date,
  timeZone: string | null | undefined,
  startHour: number,
  endHour: number,
): Date {
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  if (!(startHour >= 0 && endHour <= 24 && startHour < endHour)) return now;

  const local = partsInZone(now, tz);
  if (local.hour >= startHour && local.hour < endHour) return now; // in window
  if (local.hour < startHour) {
    return zonedWallTimeToUtc(tz, local.year, local.month, local.day, startHour);
  }
  // Past the window today → the next civil day at startHour. DST shifts by an
  // hour, never a day, so +24h reliably lands on tomorrow's date in-zone.
  const next = partsInZone(new Date(now.getTime() + 24 * 60 * 60 * 1000), tz);
  return zonedWallTimeToUtc(tz, next.year, next.month, next.day, startHour);
}
