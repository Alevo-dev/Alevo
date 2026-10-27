import { describe, expect, it } from "vitest";
import { formatSlot, offerSlots, spreadSlots } from "../lib/booking/offer";
import type { BookingAdapter, Slot } from "../lib/booking/types";

const TZ = "America/New_York";
const NOW = new Date("2026-10-26T13:00:00Z"); // Mon 9:00 AM New York

/** Hourly slots on weekdays 9–17 New York, over `days` days, as an adapter would return them. */
function hourly(days: number): Slot[] {
  const out: Slot[] = [];
  for (let d = 0; d < days; d++) {
    for (let h = 9; h < 17; h++) {
      const dt = new Date(NOW);
      dt.setUTCDate(dt.getUTCDate() + d);
      dt.setUTCHours(h + 4, 0, 0, 0); // EDT = UTC-4
      if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue;
      out.push({ startIso: dt.toISOString() });
    }
  }
  return out;
}

function adapterWith(slots: Slot[]): BookingAdapter {
  return {
    availableSlots: async (fromIso: string, toIso: string) => slots.filter((s) => s.startIso >= fromIso && s.startIso <= toIso),
    book: async () => ({ ok: false, error: "not in test" }),
    cancel: async () => ({ ok: true }),
    reschedule: async () => ({ ok: false, error: "not in test" }),
  } as unknown as BookingAdapter;
}

describe("spreadSlots", () => {
  it("takes at most one morning and one afternoon per day, earliest first", () => {
    const picked = spreadSlots(hourly(3), TZ, 4);
    expect(picked).toHaveLength(4);
    const labels = picked.map((s) => formatSlot(s.startIso, TZ, "written"));
    // Mon 9 AM, Mon 12 PM, Tue 9 AM, Tue 12 PM
    expect(labels[0]).toMatch(/^Mon, Oct 26, 9:00 AM/);
    expect(labels[1]).toMatch(/^Mon, Oct 26, 12:00 PM/);
    expect(labels[2]).toMatch(/^Tue, Oct 27, 9:00 AM/);
    expect(labels[3]).toMatch(/^Tue, Oct 27, 12:00 PM/);
  });

  it("falls back to plain order when the spread yields too few", () => {
    const one = [{ startIso: "2026-10-27T14:00:00Z" }];
    expect(spreadSlots(one, TZ, 4)).toEqual(one);
  });
});

describe("offerSlots", () => {
  it("prefers the next 72 hours with at least two hours' notice", async () => {
    const offer = await offerSlots(adapterWith(hourly(7)), TZ, 4, NOW);
    expect(offer.window).toBe("72h");
    expect(offer.slots).toHaveLength(4);
    // 9 AM and 10 AM today are within the 2-hour notice; first pick is 11 AM.
    expect(formatSlot(offer.slots[0]!.startIso, TZ, "written")).toMatch(/^Mon, Oct 26, 11:00 AM/);
    for (const s of offer.slots) {
      expect(new Date(s.startIso).getTime() - NOW.getTime()).toBeLessThanOrEqual(72 * 3600 * 1000);
    }
  });

  it("widens to a week when the next 72 hours are full", async () => {
    const later = hourly(7).filter((s) => new Date(s.startIso).getTime() - NOW.getTime() > 4 * 24 * 3600 * 1000);
    const offer = await offerSlots(adapterWith(later), TZ, 4, NOW);
    expect(offer.window).toBe("7d");
    expect(offer.slots.length).toBeGreaterThan(0);
  });

  it("reports none when the calendar is full all week", async () => {
    const offer = await offerSlots(adapterWith([]), TZ, 4, NOW);
    expect(offer).toEqual({ slots: [], window: "none" });
  });
});

describe("formatSlot", () => {
  it("writes a short form for chat and a long form for speech", () => {
    const iso = "2026-10-27T14:00:00Z";
    expect(formatSlot(iso, TZ, "written")).toBe("Tue, Oct 27, 10:00 AM EDT");
    expect(formatSlot(iso, TZ, "spoken")).toBe("Tuesday, October 27 at 10:00 AM");
  });
});
