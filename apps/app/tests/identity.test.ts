import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone } from "@alevo/db";

/** One spelling per identity, so the same person matches across form, SMS, voice and chat. */
describe("normalizeEmail", () => {
  it("trims and lowercases", () => expect(normalizeEmail("  Laith@Example.COM ")).toBe("laith@example.com"));
  it("is null for blanks", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("adds +1 to a bare 10-digit number", () => expect(normalizePhone("613-884-1155")).toBe("+16138841155"));
  it("adds + to an 11-digit number starting with 1", () => expect(normalizePhone("1 (613) 884 1155")).toBe("+16138841155"));
  it("keeps E.164 as is", () => expect(normalizePhone("+16138841155")).toBe("+16138841155"));
  it("leaves other international numbers alone apart from spacing", () => expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958"));
  it("is null for blanks and letter-only input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("n/a")).toBeNull();
  });
});
