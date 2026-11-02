import { describe, expect, it } from "vitest";
import { TONES, TONE_KEYS, toneForPrompt, toneOptions } from "../lib/profile/tone";

describe("toneForPrompt", () => {
  it("expands a preset key to its description", () => {
    expect(toneForPrompt("friendly")).toBe(TONES.find((t) => t.key === "friendly")!.description);
  });
  it("passes legacy free text through unchanged", () => {
    expect(toneForPrompt("  Plain spoken, no jargon ")).toBe("Plain spoken, no jargon");
  });
  it("returns null for blank or missing", () => {
    expect(toneForPrompt("  ")).toBeNull();
    expect(toneForPrompt(null)).toBeNull();
    expect(toneForPrompt(undefined)).toBeNull();
  });
});

describe("toneOptions", () => {
  it("lists the five presets for blank or preset values", () => {
    expect(toneOptions("")).toHaveLength(5);
    expect(toneOptions("direct")).toHaveLength(5);
  });
  it("keeps a legacy value as a trailing Custom option", () => {
    const opts = toneOptions("Plain spoken");
    expect(opts).toHaveLength(6);
    expect(opts[5]).toEqual({ value: "Plain spoken", label: "Custom: Plain spoken" });
  });
  it("truncates a long custom label but keeps the full value", () => {
    const long = "x".repeat(80);
    const last = toneOptions(long).at(-1)!;
    expect(last.value).toBe(long);
    expect(last.label.length).toBeLessThan(60);
  });
});

describe("TONE_KEYS", () => {
  it("has five unique keys", () => {
    expect(TONE_KEYS).toHaveLength(5);
    expect(new Set(TONE_KEYS).size).toBe(5);
  });
});
