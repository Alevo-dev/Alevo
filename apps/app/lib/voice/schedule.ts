import type { OrgProfile } from "@alevo/db";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/cadence/send-window";
import type { VoiceMode } from "./prompt";

/** The org's timezone, falling back to the app default like the rest of the app (never UTC). */
export function profileTimeZone(profile: OrgProfile): string {
  return isValidTimeZone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE;
}

/**
 * Office hours for inbound voice: weekdays, between the booking window's start
 * and end hours, in the org's time zone. Voice has no separate hours yet, so it
 * reuses the booking window (see the Agent settings).
 */
export function isOpenNow(profile: OrgProfile, now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: profileTimeZone(profile),
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  if (weekday === "Sat" || weekday === "Sun") return false;
  return hour >= profile.bookingHoursStart && hour < profile.bookingHoursEnd;
}

/** Which assistant an incoming call gets right now. */
export function voiceModeNow(profile: OrgProfile, now: Date = new Date()): VoiceMode {
  if (!profile.voiceEnabled) return "closed";
  return isOpenNow(profile, now) ? "open" : "after_hours";
}

/** Cheap check (no network): is the org's chosen API booking tool configured? */
export function bookingLinked(profile: OrgProfile): boolean {
  const tool = profile.bookingTool;
  if (tool === "calcom") return Boolean(profile.calcomEventTypeId);
  if (tool === "google" || tool === "m365") return profile.calendarProvider === tool && Boolean(profile.calendarId);
  return false; // off, or Calendly (link mode has nothing for a live call to book through)
}
