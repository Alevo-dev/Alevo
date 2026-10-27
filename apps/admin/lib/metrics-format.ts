import type { Tone } from "@alevo/ui/tone";

/**
 * Display helpers for the console's performance table. The window and the
 * speed-to-lead grading match the tenant dashboard (`apps/app/lib/dashboard/window.ts`).
 */

export const WINDOWS = [7, 30, 90] as const;
export type Window = (typeof WINDOWS)[number];

export function parseWindow(value: unknown): Window {
  const n = Number(value);
  return (WINDOWS as readonly number[]).includes(n) ? (n as Window) : 7;
}

/** Seconds → "42s" / "3m 10s" / "2h 5m"; "—" when there is nothing to show. */
export function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** p95 against the 60-second promise, as a pill: label + tone. */
export function speedView(p95: number | null, replied: number): { label: string; tone: Tone } {
  if (p95 == null || replied === 0) return { label: "No replies", tone: "muted" };
  if (p95 <= 60) return { label: "Under a minute", tone: "success" };
  if (p95 <= 300) return { label: "Over target", tone: "warning" };
  return { label: "Well over", tone: "danger" };
}

export function pct(n: number, of: number): string {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : "—";
}

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });

/** `Oct 27, 1:05 PM` (UTC — the console is internal; tenants see their own zone). */
export function fmtWhen(value: Date | string | null): string {
  return value ? WHEN.format(new Date(value)) : "—";
}

/** How many bars a window draws: per day under 90 days, per week at 90 (13). */
export function bucketCount(days: Window): number {
  return days >= 90 ? Math.ceil(days / 7) : days;
}

/** `(periods ago, count)` rows → a fixed-length series, oldest first, zeros where nothing happened. */
export function toSeries(rows: { ago: number; n: number }[], buckets: number): number[] {
  const out = new Array<number>(buckets).fill(0);
  for (const r of rows) {
    const i = buckets - 1 - r.ago;
    if (i >= 0 && i < buckets) out[i] = r.n;
  }
  return out;
}
