import { describe, expect, it } from "vitest";
import { chatTextColour, contrastRatio, hexToHsv, hsvToHex, normaliseHex } from "../lib/colour";

describe("normaliseHex", () => {
  it("accepts six digits with or without #, any case, and trims", () => {
    expect(normaliseHex("#FF6A00")).toBe("#ff6a00");
    expect(normaliseHex("ff6a00")).toBe("#ff6a00");
    expect(normaliseHex("  #2E9be6 ")).toBe("#2e9be6");
  });

  it("expands the three-digit shorthand", () => {
    expect(normaliseHex("#f60")).toBe("#ff6600");
    expect(normaliseHex("0AF")).toBe("#00aaff");
  });

  it("rejects anything else", () => {
    for (const bad of ["", "red", "#12345", "#1234567", "#gg0000", "rgb(1,2,3)", "#ff 6a00"]) {
      expect(normaliseHex(bad), bad).toBeNull();
    }
  });
});

describe("hexToHsv / hsvToHex", () => {
  it("reads the primaries", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00ff00")).toEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv("#0000ff")).toEqual({ h: 240, s: 1, v: 1 });
  });

  it("reads white and black as no saturation / no brightness", () => {
    expect(hexToHsv("#ffffff")).toEqual({ h: 0, s: 0, v: 1 });
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
  });

  it("writes hex from hue, saturation and brightness", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00ff00");
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe("#0000ff");
    expect(hsvToHex({ h: 200, s: 0, v: 0.5 })).toBe("#808080");
  });

  it("round-trips real brand colours exactly", () => {
    for (const hex of ["#ff6a00", "#2e9be6", "#1b2a49", "#e11d48", "#16a34a", "#7c3aed", "#808080", "#010203"]) {
      expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex);
    }
  });

  it("clamps out-of-range input instead of producing a bad colour", () => {
    expect(hsvToHex({ h: 400, s: 2, v: -1 })).toBe("#000000");
    expect(hsvToHex({ h: -60, s: 1, v: 1 })).toBe("#ff00ff");
  });
});

describe("chatTextColour: the text colour chat.js picks on an accent when data-color is not set", () => {
  it("is white on Alevo blue and on dark colours", () => {
    expect(chatTextColour("#2e9be6")).toBe("#ffffff");
    expect(chatTextColour("#1b2a49")).toBe("#ffffff");
    expect(chatTextColour("#000000")).toBe("#ffffff");
  });

  it("is navy on orange and on light colours", () => {
    expect(chatTextColour("#ff6a00")).toBe("#06091a");
    expect(chatTextColour("#ffd600")).toBe("#06091a");
    expect(chatTextColour("#ffffff")).toBe("#06091a");
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for the same colour", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#2e9be6", "#2e9be6")).toBeCloseTo(1, 5);
  });

  it("flags white on orange as weak and navy on orange as fine", () => {
    expect(contrastRatio("#ffffff", "#ff6a00")).toBeLessThan(3);
    expect(contrastRatio("#06091a", "#ff6a00")).toBeGreaterThan(4.5);
  });
});
