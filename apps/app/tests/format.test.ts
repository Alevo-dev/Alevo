import { describe, expect, it } from "vitest";
import { fmtDuration, utcOffsetLabel } from "../lib/format";
import { timezoneOptions, timezoneRequiredError } from "../lib/timezones";

const WINTER = new Date("2026-01-15T12:00:00Z");
const SUMMER = new Date("2026-07-15T12:00:00Z");

/** The hours from UTC, as the zone stands on that day (daylight saving moves it). */
describe("utcOffsetLabel", () => {
  it("shows whole-hour offsets with a sign", () => {
    expect(utcOffsetLabel("America/New_York", WINTER)).toBe("UTC-5");
    expect(utcOffsetLabel("America/Los_Angeles", WINTER)).toBe("UTC-8");
  });
  it("follows daylight saving", () => {
    expect(utcOffsetLabel("America/New_York", SUMMER)).toBe("UTC-4");
    expect(utcOffsetLabel("America/Phoenix", SUMMER)).toBe("UTC-7");
    expect(utcOffsetLabel("America/Denver", SUMMER)).toBe("UTC-6");
  });
  it("shows half hours, and plus for east of UTC", () => {
    expect(utcOffsetLabel("Asia/Kolkata", WINTER)).toBe("UTC+5:30");
    expect(utcOffsetLabel("Asia/Tokyo", WINTER)).toBe("UTC+9");
    expect(utcOffsetLabel("UTC", WINTER)).toBe("UTC+0");
  });
});

/** The timezone picker: one entry per zone, each with its hours from UTC. */
describe("timezoneRequiredError", () => {
  it("stops the agent going live without a timezone", () => {
    expect(timezoneRequiredError(true, "")).toMatch(/timezone/i);
  });
  it("lets it go live with one, and lets it stay off without one", () => {
    expect(timezoneRequiredError(true, "America/Chicago")).toBeNull();
    expect(timezoneRequiredError(false, "")).toBeNull();
  });
});

describe("timezoneOptions", () => {
  const opts = timezoneOptions("", WINTER);
  it("lists each zone once, with its offset", () => {
    expect(opts.map((o) => o.label)).toEqual([
      "Choose a timezone",
      "Eastern (UTC-5)",
      "Central (UTC-6)",
      "Mountain (UTC-7)",
      "Mountain, no daylight saving (UTC-7)",
      "Pacific (UTC-8)",
      "Atlantic (UTC-4)",
    ]);
    expect(new Set(opts.map((o) => o.label)).size).toBe(opts.length);
  });
  it("keeps a saved zone that is not in the list, so saving never silently changes it", () => {
    const withSaved = timezoneOptions("America/Toronto", WINTER);
    expect(withSaved.at(-1)).toEqual({ value: "America/Toronto", label: "America/Toronto (UTC-5)" });
  });
});

/** Call lengths read like a person says them. */
describe("fmtDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(fmtDuration(4)).toBe("4 s");
    expect(fmtDuration(161)).toBe("2 min 41 s");
    expect(fmtDuration(120)).toBe("2 min");
    expect(fmtDuration(3725)).toBe("1 h 2 min");
  });

  it("is a dash when unknown", () => {
    expect(fmtDuration(null)).toBe("—");
    expect(fmtDuration(undefined)).toBe("—");
  });
});
