/** Display helpers shared by the app's screens. Pure, SSR-safe. */
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/cadence/send-window";

type Style = "dateTime" | "short" | "time" | "date";

const STYLE: Record<Style, Intl.DateTimeFormatOptions> = {
  dateTime: { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
  short: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
  date: { month: "short", day: "numeric", year: "numeric" },
};

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(style: Style, tz: string): Intl.DateTimeFormat {
  const timeZone = isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
  const key = `${style}|${timeZone}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { ...STYLE[style], timeZone });
    cache.set(key, f);
  }
  return f;
}

/** `Oct 21, 2026, 1:00 PM` in the given timezone (the org's, by default). */
export function fmtDateTime(value: Date | string | null | undefined, tz = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return formatter("dateTime", tz).format(new Date(value));
}

/** `Oct 21, 1:00 PM` — for feeds and lists where the year is noise. */
export function fmtShort(value: Date | string | null | undefined, tz = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return formatter("short", tz).format(new Date(value));
}

/** `1:00 PM` — the time part only. */
export function fmtTime(value: Date | string, tz = DEFAULT_TIMEZONE): string {
  return formatter("time", tz).format(new Date(value));
}

/** `Oct 21, 2026`. */
export function fmtDate(value: Date | string | null | undefined, tz = DEFAULT_TIMEZONE): string {
  if (!value) return "—";
  return formatter("date", tz).format(new Date(value));
}

/** Short zone name for the moment, e.g. `EDT`, to label a page's times. */
export function tzLabel(tz = DEFAULT_TIMEZONE, at: Date = new Date()): string {
  const timeZone = isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback: string | null | undefined,
): string {
  return [firstName, lastName].filter(Boolean).join(" ") || fallback || "—";
}

/** Up to two initials for an avatar disc. */
export function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return chars.join("") || fallback;
}

export function fmtSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}
