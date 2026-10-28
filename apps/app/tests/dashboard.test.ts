import { describe, expect, it } from "vitest";
import {
  bucketCount,
  bucketFor,
  bucketLabels,
  bucketShortLabels,
  coverDays,
  fmtDuration,
  labelStep,
  niceMax,
  parseWindow,
  showLabel,
  speedLevel,
} from "../lib/dashboard/window";

describe("axis labels", () => {
  it("shortens week buckets to their last day and thins ticks", () => {
    const short = bucketShortLabels("2026-10-27", 90);
    expect(short[12]).toBe("Oct 27");
    expect(short[11]).toBe("Oct 20");
    expect(bucketShortLabels("2026-10-27", 7)[0]).toBe("Oct 21");
    expect(labelStep(7)).toBe(1);
    expect(labelStep(13)).toBe(2);
    expect(labelStep(30)).toBe(4);
    expect(labelStep(13, 5)).toBe(3);
  });
  it("never puts two labels side by side at the end", () => {
    // 30 buckets, step 4: 28 is on the grid but next to the last tick, so it is skipped.
    const shown = Array.from({ length: 30 }, (_, i) => i).filter((i) => showLabel(i, 30, 4));
    expect(shown).toEqual([0, 4, 8, 12, 16, 20, 24, 29]);
    const seven = Array.from({ length: 7 }, (_, i) => i).filter((i) => showLabel(i, 7, 1));
    expect(seven).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("parseWindow", () => {
  it("accepts the three windows and falls back to 7", () => {
    expect(parseWindow("30")).toBe(30);
    expect(parseWindow("90")).toBe(90);
    expect(parseWindow("7")).toBe(7);
    expect(parseWindow("14")).toBe(7);
    expect(parseWindow(undefined)).toBe(7);
  });
});

describe("buckets", () => {
  it("reads 7 and 30 days per day, 90 per week", () => {
    expect(bucketFor(7)).toBe("day");
    expect(bucketFor(30)).toBe("day");
    expect(bucketFor(90)).toBe("week");
    expect(bucketCount(7)).toBe(7);
    expect(bucketCount(30)).toBe(30);
    expect(bucketCount(90)).toBe(13);
    expect(coverDays(90)).toBe(91);
    expect(coverDays(30)).toBe(30);
  });
  it("labels days oldest first and weeks as ranges ending today", () => {
    const days = bucketLabels("2026-10-27", 7);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("Oct 21");
    expect(days[6]).toBe("Oct 27");
    const weeks = bucketLabels("2026-10-27", 90);
    expect(weeks).toHaveLength(13);
    expect(weeks[12]).toBe("Oct 21 – Oct 27");
    expect(weeks[11]).toBe("Oct 14 – Oct 20");
  });
});

describe("niceMax", () => {
  it("rounds up to a clean ceiling with a floor of 4", () => {
    expect(niceMax(0)).toBe(4);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(12)).toBe(20);
    expect(niceMax(41)).toBe(50);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(101)).toBe(200);
  });
});

describe("fmtDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(fmtDuration(42)).toBe("42s");
    expect(fmtDuration(190)).toBe("3m 10s");
    expect(fmtDuration(180)).toBe("3m");
    expect(fmtDuration(7500)).toBe("2h 5m");
  });
});

describe("speedLevel", () => {
  it("grades p95 against the 60-second target", () => {
    expect(speedLevel(null)).toBe("muted");
    expect(speedLevel(45)).toBe("success");
    expect(speedLevel(60)).toBe("success");
    expect(speedLevel(200)).toBe("warning");
    expect(speedLevel(900)).toBe("danger");
  });
});

describe("showRatePct", () => {
  it("is null until an outcome is marked, then showed over held", async () => {
    const { showRatePct } = await import("../lib/dashboard/window");
    expect(showRatePct(0, 0)).toBeNull();
    expect(showRatePct(4, 5)).toBe(80);
    expect(showRatePct(1, 3)).toBe(33);
    expect(showRatePct(5, 5)).toBe(100);
  });
});
