import { zonedToUtc } from "./slots";
import type { BookingAdapter, Slot } from "./types";

/**
 * The slots the agent OFFERS a qualified lead, on every channel. The goal of
 * the product is a booked meeting, so the offer is concrete and near: a few
 * times spread over the next 24–72 hours (morning and afternoon, different
 * days), with at least a little notice. If the calendar is full that soon,
 * the search widens to a week so the lead still gets real options.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Don't offer a slot the lead would have to run to. */
const MIN_NOTICE_MS = 2 * HOUR_MS;
const PREFERRED_WINDOW_MS = 72 * HOUR_MS;
const FALLBACK_WINDOW_MS = 7 * DAY_MS;

export type SlotOffer = {
  /** Up to `max` slots, spread across days and halves of the day. */
  slots: Slot[];
  /** Which search window produced them. */
  window: "72h" | "7d" | "none";
};

/** Local day key + hour in `timeZone`, for spreading the picks. */
function localParts(iso: string, timeZone: string): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/**
 * Pick a spread: at most one morning and one afternoon slot per local day,
 * earliest first, until `max`. Falls back to plain order if that yields too few.
 */
export function spreadSlots(slots: Slot[], timeZone: string, max: number): Slot[] {
  const taken = new Set<string>();
  const picked: Slot[] = [];
  for (const s of slots) {
    const { day, hour } = localParts(s.startIso, timeZone);
    const key = `${day}:${hour < 12 ? "am" : "pm"}`;
    if (taken.has(key)) continue;
    taken.add(key);
    picked.push(s);
    if (picked.length >= max) break;
  }
  if (picked.length >= Math.min(2, slots.length)) return picked;
  return slots.slice(0, max);
}

/** The slots to offer, preferring the next 72 hours. */
export async function offerSlots(adapter: BookingAdapter, timeZone: string, max = 4, now = new Date()): Promise<SlotOffer> {
  const fromIso = new Date(now.getTime() + MIN_NOTICE_MS).toISOString();
  const soon = await adapter.availableSlots(fromIso, new Date(now.getTime() + PREFERRED_WINDOW_MS).toISOString(), timeZone);
  if (soon.length >= 2) return { slots: spreadSlots(soon, timeZone, max), window: "72h" };

  const week = await adapter.availableSlots(fromIso, new Date(now.getTime() + FALLBACK_WINDOW_MS).toISOString(), timeZone);
  if (week.length === 0) return { slots: [], window: "none" };
  return { slots: spreadSlots(week, timeZone, max), window: "7d" };
}

/** The UTC window of one local calendar day (`YYYY-MM-DD`) in `timeZone`, or null if it isn't a date. */
export function dayWindow(day: string, timeZone: string): { fromIso: string; toIso: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const from = zonedToUtc(y, mo, d, 0, 0, timeZone);
  if (Number.isNaN(from.getTime())) return null;
  return { fromIso: from.toISOString(), toIso: zonedToUtc(y, mo, d + 1, 0, 0, timeZone).toISOString() };
}

/**
 * Every open slot on one local day, for "anything Wednesday around 11?". The
 * spread offer is a first pass; this is the full list once the lead names a day.
 */
export async function daySlots(adapter: BookingAdapter, day: string, timeZone: string, now = new Date()): Promise<Slot[] | null> {
  const w = dayWindow(day, timeZone);
  if (!w) return null;
  const earliest = new Date(now.getTime() + MIN_NOTICE_MS).toISOString();
  // A day already over (or ending inside the notice window) has nothing to offer; an
  // empty range would make the calendar answer 400 and read as "calendar broke".
  if (w.toIso <= earliest) return [];
  return adapter.availableSlots(w.fromIso > earliest ? w.fromIso : earliest, w.toIso, timeZone);
}

/** "Tue, Oct 28, 10:00 AM EDT" (chat / email) or "Tuesday, October 28 at 10:00 AM" (spoken). */
export function formatSlot(iso: string, timeZone: string, style: "written" | "spoken"): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: style === "spoken" ? "long" : "short",
    month: style === "spoken" ? "long" : "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(style === "written" ? { timeZoneName: "short" as const } : {}),
  });
  return fmt.format(new Date(iso));
}
