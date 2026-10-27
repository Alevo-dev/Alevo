/**
 * Pure helpers for the dashboard's time window (`?window=7|30|90`): bucketing,
 * labels, percentiles, durations. No I/O, so `tests/dashboard.test.ts` covers it.
 */

export const WINDOWS = [7, 30, 90] as const;
export type Window = (typeof WINDOWS)[number];
export const DEFAULT_WINDOW: Window = 7;

export type Bucket = "day" | "week";

/** `?window=` → one of the allowed windows; anything else is the default. */
export function parseWindow(value: unknown): Window {
  const n = Number(value);
  return (WINDOWS as readonly number[]).includes(n) ? (n as Window) : DEFAULT_WINDOW;
}

/** 7 and 30 days read per day; 90 days reads per week (13 bars, not 90). */
export function bucketFor(days: Window): Bucket {
  return days >= 90 ? "week" : "day";
}

/** How many bars the window draws. */
export function bucketCount(days: Window): number {
  return bucketFor(days) === "week" ? Math.ceil(days / 7) : days;
}

/** Days the query must reach back so every bucket is complete (today inclusive). */
export function coverDays(days: Window): number {
  return bucketFor(days) === "week" ? bucketCount(days) * 7 : days;
}

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** A YYYY-MM-DD (the org's "today") minus n days, as a UTC Date for formatting only. */
function shift(todayIso: string, minusDays: number): Date {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - minusDays);
  return d;
}

/** One label per bucket, oldest first: "Oct 21" per day, "Oct 15 – Oct 21" per week. */
export function bucketLabels(todayIso: string, days: Window): string[] {
  const n = bucketCount(days);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    if (bucketFor(days) === "day") {
      out.push(MONTH.format(shift(todayIso, i)));
    } else {
      const end = shift(todayIso, i * 7);
      const start = shift(todayIso, i * 7 + 6);
      out.push(`${MONTH.format(start)} – ${MONTH.format(end)}`);
    }
  }
  return out;
}

/** Short axis labels, one per bucket: the day ("Oct 21"), or a week's last day. */
export function bucketShortLabels(todayIso: string, days: Window): string[] {
  const n = bucketCount(days);
  const step = bucketFor(days) === "day" ? 1 : 7;
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(MONTH.format(shift(todayIso, i * step)));
  return out;
}

/** Label every k-th axis tick so at most `maxLabels` show: 7 → all, 13 → every 2nd, 30 → every 4th. */
export function labelStep(n: number, maxLabels = 8): number {
  return Math.max(1, Math.ceil(n / Math.max(2, maxLabels)));
}

/** Whether tick `i` of `n` gets a label: on the step grid, plus the last one, never two side by side. */
export function showLabel(i: number, n: number, step: number): boolean {
  if (i === n - 1) return true;
  return i % step === 0 && n - 1 - i >= step;
}

/** A clean axis ceiling at or above `max` (1, 2, 5 × 10^k; never below 4 so small counts keep room). */
export function niceMax(max: number): number {
  if (max <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) {
    if (step * mag >= max) return step * mag;
  }
  return 10 * mag;
}

/** Seconds → "42s" / "3m 10s" / "2h 5m". */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export type SpeedLevel = "success" | "warning" | "danger" | "muted";

/** p95 against the 60-second target: green under a minute, amber under five, red beyond. */
export function speedLevel(p95Seconds: number | null): SpeedLevel {
  if (p95Seconds == null) return "muted";
  if (p95Seconds <= 60) return "success";
  if (p95Seconds <= 300) return "warning";
  return "danger";
}
