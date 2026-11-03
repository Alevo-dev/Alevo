import { describe, expect, it } from "vitest";
import { fmtDuration } from "../lib/format";

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
