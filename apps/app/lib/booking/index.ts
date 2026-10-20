import "server-only";
import type { BookingProvider, OrgProfile } from "@alevo/db";
import { makeCalcomAdapter } from "./calcom";
import { makeGoogleAdapter, type CalendarConfig } from "./google";
import { makeM365Adapter } from "./m365";
import type { BookingAdapter } from "./types";

export type { BookingAdapter, BookParams, BookResult, Slot } from "./types";

/**
 * Everything the factory needs to resolve an org's booking adapter. Precedence:
 * Cal.com (API key + event type) → a connected calendar (Google / M365). Link
 * mode (Calendly) has no adapter — it's handled by the Qualifier directly.
 */
export type BookingConfig = {
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
 * Resolve the org's API booking adapter, or null if none is connected. Cal.com
 * wins when its key + event type are set; otherwise a connected Google / M365
 * calendar. (Calendly link mode returns null here by design.)
 */
export async function getBookingAdapter(
  orgId: string,
  cfg: BookingConfig,
): Promise<BookingAdapter | null> {
  if (cfg.calcomEventTypeId) {
    const calcom = await makeCalcomAdapter(orgId, cfg.calcomEventTypeId);
    if (calcom) return calcom;
  }
  if (cfg.calendarProvider && cfg.calendarId) {
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
