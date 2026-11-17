import { utcOffsetLabel } from "@/lib/format";

/**
 * The timezones an org can pick as its default: one entry per zone (cities that share a clock,
 * like New York and Toronto, are one), each shown with its hours from UTC as of today.
 * An empty value means none chosen yet, which keeps the agent from going live.
 */
const ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Mountain, no daylight saving"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Halifax", "Atlantic"],
] as const;

export type TimezoneOption = { value: string; label: string };

/**
 * `saved` is the zone already stored; one that is not in the list (an older city pick) is kept
 * as its own entry so opening and saving the page never changes it unnoticed.
 */
export function timezoneOptions(saved = "", at: Date = new Date()): TimezoneOption[] {
  const off = (tz: string) => utcOffsetLabel(tz, at);
  const options: TimezoneOption[] = [
    { value: "", label: "Choose a timezone" },
    ...ZONES.map(([value, name]) => ({ value, label: `${name} (${off(value)})` })),
  ];
  if (saved && !options.some((o) => o.value === saved)) options.push({ value: saved, label: `${saved} (${off(saved)})` });
  return options;
}

/** The agent offers and books times in the org's timezone until it learns the contact's, so it can't go live without one. */
export function timezoneRequiredError(enabled: boolean, timezone: string): string | null {
  return enabled && !timezone ? "Choose the organization's timezone before turning the agent on." : null;
}
