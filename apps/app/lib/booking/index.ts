import "server-only";
import type { BookingProvider, OrgProfile } from "@alevo/db";
import { makeCalcomAdapter } from "./calcom";
import { makeGoogleAdapter, type CalendarConfig } from "./google";
import { makeM365Adapter } from "./m365";
import type { BookingAdapter } from "./types";

export type { BookingAdapter, BookParams, BookResult, Slot } from "./types";

/**
 * Everything the factory needs to resolve an org's booking adapter. The org
 * chooses ONE tool (`bookingTool`, Workspace → Agent → Booking); the adapter
 * is built only for that tool, and only when it is configured. Link mode
 * (Calendly) has no adapter — it's handled by the Qualifier directly.
 */
export type BookingConfig = {
  bookingTool: BookingProvider | null; // null = booking off
  calcomEventTypeId: number | null;
  calendarProvider: BookingProvider | null; // 'google' | 'm365' when connected
  calendarId: string | null;
  bookingLengthMin: number;
  bookingHoursStart: number;
  bookingHoursEnd: number;
  timeZone: string | null;
};

export function bookingConfigFromProfile(profile: OrgProfile): BookingConfig {
  return {
    bookingTool: profile.bookingTool,
    calcomEventTypeId: profile.calcomEventTypeId,
    calendarProvider: profile.calendarProvider,
    calendarId: profile.calendarId,
    bookingLengthMin: profile.bookingLengthMin,
    bookingHoursStart: profile.bookingHoursStart,
    bookingHoursEnd: profile.bookingHoursEnd,
    timeZone: profile.timezone,
  };
}

/**
 * Resolve the org's API booking adapter for its chosen tool, or null when
 * booking is off or the tool isn't configured yet. (Calendly link mode returns
 * null here by design.)
 */
export async function getBookingAdapter(
  orgId: string,
  cfg: BookingConfig,
): Promise<BookingAdapter | null> {
  if (cfg.bookingTool === "calcom") {
    if (!cfg.calcomEventTypeId) return null;
    return makeCalcomAdapter(orgId, cfg.calcomEventTypeId);
  }
  const calendarChosen = cfg.bookingTool === "google" || cfg.bookingTool === "m365";
  if (calendarChosen && cfg.calendarProvider === cfg.bookingTool && cfg.calendarId) {
    const calendar: CalendarConfig = {
      calendarId: cfg.calendarId,
      lengthMin: cfg.bookingLengthMin,
      hoursStart: cfg.bookingHoursStart,
      hoursEnd: cfg.bookingHoursEnd,
      timeZone: cfg.timeZone ?? "UTC",
    };
    if (cfg.calendarProvider === "google") return makeGoogleAdapter(orgId, calendar);
    if (cfg.calendarProvider === "m365") return makeM365Adapter(orgId, calendar);
  }
  return null;
}
