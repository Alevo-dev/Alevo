/**
 * Shared slot generator for the direct calendar adapters (Google / M365).
 *
 * Both providers return "busy" intervals; we turn those into bookable slots
 * using simple rules — a daily working-hours window, a fixed meeting length,
 * weekdays only, no slots in the past. Deliberately basic: buffers, notice
 * rules, and round-robin are Cal.com's job, not ours (plan.md Sprint 3).
 */

export type BusyInterval = { start: Date; end: Date };

export type SlotRules = {
  /** Window to search, ISO-8601 (UTC). */
  fromIso: string;
  toIso: string;
  /** IANA timezone the working hours are expressed in. */
  timeZone: string;
  /** Meeting length in minutes (also the step between candidate starts). */
  lengthMin: number;
  /** Local working-hours window: start inclusive, end exclusive (24h clock). */
  hoursStart: number;
  hoursEnd: number;
  busy: BusyInterval[];
};

/** Parse an Intl parts array into a lookup; missing parts default to "0". */
function partMap(parts: Intl.DateTimeFormatPart[]): (type: string) => string {
  const m = new Map<string, string>(parts.map((x) => [x.type, x.value]));
  return (type) => m.get(type) ?? "0";
}

/** Offset (local − UTC) in ms for `timeZone` at the given instant. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const get = partMap(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at),
  );
  const asUtc = Date.UTC(
    +get("year"),
    +get("month") - 1,
    +get("day"),
    +get("hour"),
    +get("minute"),
    +get("second"),
  );
  return asUtc - at.getTime();
}

/** The UTC instant for a wall-clock time in `timeZone`. */
function zonedToUtc(
  year: number,
  month: number, // 1–12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(guess.getTime() - tzOffsetMs(guess, timeZone));
}

/** Local calendar date + weekday for an instant, in `timeZone`. */
function localDate(at: Date, timeZone: string) {
  const get = partMap(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(at),
  );
  return { year: +get("year"), month: +get("month"), day: +get("day"), weekday: get("weekday") };
}

const WEEKEND = new Set(["Sat", "Sun"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export function generateSlots(rules: SlotRules, now: Date = new Date()): { startIso: string }[] {
  const from = new Date(rules.fromIso);
  const to = new Date(rules.toIso);
  const lengthMs = rules.lengthMin * 60_000;
  const workMin = (rules.hoursEnd - rules.hoursStart) * 60;
  if (workMin < rules.lengthMin) return [];

  const slots: { startIso: string }[] = [];
  const seen = new Set<string>();

  // Walk each day in the window (one step per local day, capped defensively).
  for (let d = 0; d <= 62; d++) {
    const dayAnchor = new Date(from.getTime() + d * DAY_MS);
    if (dayAnchor.getTime() > to.getTime() + DAY_MS) break;
    const { year, month, day, weekday } = localDate(dayAnchor, rules.timeZone);
    if (WEEKEND.has(weekday)) continue;

    for (let off = 0; off + rules.lengthMin <= workMin; off += rules.lengthMin) {
      const total = rules.hoursStart * 60 + off;
      const start = zonedToUtc(year, month, day, Math.floor(total / 60), total % 60, rules.timeZone);
      if (start <= now) continue;
      if (start < from || start > to) continue;
      const end = new Date(start.getTime() + lengthMs);
      const clash = rules.busy.some((b) => start < b.end && end > b.start);
      if (clash) continue;
      const iso = start.toISOString();
      if (seen.has(iso)) continue;
      seen.add(iso);
      slots.push({ startIso: iso });
    }
  }

  slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
  return slots;
}

/** True if [startIso, startIso+lengthMin) overlaps any busy interval. */
export function isBusy(startIso: string, lengthMin: number, busy: BusyInterval[]): boolean {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + lengthMin * 60_000);
  return busy.some((b) => start < b.end && end > b.start);
}
