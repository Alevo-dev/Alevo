import { describe, expect, it } from "vitest";
import { crossedThreshold, pct, usageLevel } from "../lib/usage/levels";

describe("usageLevel", () => {
  it("is ok below 80%", () => {
    expect(usageLevel(0, 500)).toBe("ok");
    expect(usageLevel(399, 500)).toBe("ok");
  });
  it("warns from 80% and flags exceeded at the allowance", () => {
    expect(usageLevel(400, 500)).toBe("warning");
    expect(usageLevel(499, 500)).toBe("warning");
    expect(usageLevel(500, 500)).toBe("exceeded");
    expect(usageLevel(650, 500)).toBe("exceeded");
  });
  it("treats a zero allowance as not metered", () => {
    expect(usageLevel(10, 0)).toBe("ok");
  });
});

describe("crossedThreshold", () => {
  it("fires warning once, on the increment that reaches 80%", () => {
    expect(crossedThreshold(398, 399, 500)).toBeNull();
    expect(crossedThreshold(399, 400, 500)).toBe("warning");
    expect(crossedThreshold(400, 401, 500)).toBeNull();
  });
  it("fires exceeded once, on the increment that reaches the allowance", () => {
    expect(crossedThreshold(499, 500, 500)).toBe("exceeded");
    expect(crossedThreshold(500, 501, 500)).toBeNull();
  });
  it("reports the higher threshold when one jump crosses both (voice minutes)", () => {
    expect(crossedThreshold(700, 1010, 1000)).toBe("exceeded");
  });
  it("ignores unmetered allowances and non-increments", () => {
    expect(crossedThreshold(0, 5, 0)).toBeNull();
    expect(crossedThreshold(5, 5, 10)).toBeNull();
  });
});

describe("pct", () => {
  it("rounds and caps at 100", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(600, 500)).toBe(100);
    expect(pct(3, 0)).toBe(0);
  });
});
