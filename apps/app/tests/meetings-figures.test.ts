import { describe, expect, it } from "vitest";
import { deltaView, priorLabel } from "@/lib/meetings/figures";

describe("deltaView", () => {
  it("marks more bookings as favourable", () => {
    expect(deltaView(36, 30, "up", "vs prior 30 days")).toEqual({ text: "▲ 6 vs prior 30 days", favourable: true });
  });
  it("marks fewer no-shows as favourable and more as not", () => {
    expect(deltaView(5, 6, "down", "vs prior 30 days").favourable).toBe(true);
    expect(deltaView(7, 6, "down", "vs prior 30 days")).toEqual({ text: "▲ 1 vs prior 30 days", favourable: false });
  });
  it("says so when nothing moved", () => {
    expect(deltaView(3, 3, "up", "vs yesterday")).toEqual({ text: "— No change", favourable: false });
  });
});

describe("priorLabel", () => {
  it("names the comparison", () => {
    expect(priorLabel(1)).toBe("vs yesterday");
    expect(priorLabel(90)).toBe("vs prior 90 days");
  });
});
