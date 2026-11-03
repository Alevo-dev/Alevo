import { describe, expect, it } from "vitest";
import { busyFromFreeBusy } from "../lib/booking/freebusy";
import { daySlots, dayWindow } from "../lib/booking/offer";
import type { BookingAdapter } from "../lib/booking/types";

/**
 * The agent must never offer times it cannot see. Google's free/busy answers 200
 * with a per-calendar `errors` list (and no `busy`) when the calendar can't be
 * read; treating that as "all free" is how a caller gets offered 9 and 12 on a
 * calendar nobody looked at.
 */
describe("busyFromFreeBusy", () => {
  it("maps busy intervals", () => {
    const busy = busyFromFreeBusy({ calendars: { primary: { busy: [{ start: "2026-11-04T14:00:00Z", end: "2026-11-04T15:00:00Z" }] } } }, "primary");
    expect(busy).toEqual([{ start: new Date("2026-11-04T14:00:00Z"), end: new Date("2026-11-04T15:00:00Z") }]);
  });

  it("throws when the calendar reports an error instead of busy times", () => {
    const json = { calendars: { primary: { errors: [{ domain: "global", reason: "notFound" }] } } };
    expect(() => busyFromFreeBusy(json, "primary")).toThrow(/notFound/);
  });

  it("throws when the calendar is missing from the answer", () => {
    expect(() => busyFromFreeBusy({ calendars: {} }, "primary")).toThrow(/no answer/i);
  });
});

/** "Any time Wednesday?" → the whole local day, so the agent can list every open slot. */
describe("dayWindow", () => {
  it("covers one local day in the given timezone", () => {
    const w = dayWindow("2026-11-04", "America/Toronto");
    expect(w).toEqual({ fromIso: "2026-11-04T05:00:00.000Z", toIso: "2026-11-05T05:00:00.000Z" });
  });

  it("rejects anything that is not a date", () => {
    expect(dayWindow("Wednesday", "America/Toronto")).toBeNull();
    expect(dayWindow("2026-13-40", "America/Toronto")).toBeNull();
  });
});

/** "Anything today?" at 6pm, or a day already gone: nothing open, and the calendar is not even asked (an empty range is a 400). */
describe("daySlots", () => {
  const calls: string[] = [];
  const adapter = {
    provider: "google",
    availableSlots: async (from: string) => {
      calls.push(from);
      return [{ startIso: from }];
    },
  } as unknown as BookingAdapter;

  it("returns [] for a day that is already over without calling the calendar", async () => {
    const now = new Date("2026-11-04T23:30:00.000Z"); // 6:30pm Toronto
    expect(await daySlots(adapter, "2026-11-03", "America/Toronto", now)).toEqual([]); // yesterday
    expect(await daySlots(adapter, "2026-11-04", "Pacific/Auckland", now)).toEqual([]); // already Nov 5 there, with notice
    expect(calls).toEqual([]);
  });

  it("asks from the notice floor when the day is today", async () => {
    const now = new Date("2026-11-04T14:00:00.000Z"); // 9am Toronto
    const slots = await daySlots(adapter, "2026-11-04", "America/Toronto", now);
    expect(slots).toEqual([{ startIso: "2026-11-04T16:00:00.000Z" }]); // 2h notice
  });
});
