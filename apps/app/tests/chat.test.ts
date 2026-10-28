import { describe, expect, it } from "vitest";
import { bearerToken, cleanMessage, hashToken, isHexColor, MAX_MESSAGE_CHARS, newToken, PRESENCE_MS, visitorPresent } from "../lib/chat/rules";

/** Pure rules behind the website chat: message hygiene, tokens, presence. No DB. */

describe("cleanMessage", () => {
  it("trims, normalises line endings and keeps line breaks", () => {
    expect(cleanMessage("  hi \r\nthere  \n")).toBe("hi\nthere");
  });
  it("rejects empty and non-string input", () => {
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage(undefined)).toBeNull();
    expect(cleanMessage(42)).toBeNull();
  });
  it("caps very long messages", () => {
    expect(cleanMessage("x".repeat(MAX_MESSAGE_CHARS + 50))).toHaveLength(MAX_MESSAGE_CHARS);
  });
});

describe("tokens", () => {
  it("are URL-safe, unique and stored only as a stable hash", () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
    expect(hashToken(a)).toHaveLength(64);
  });
  it("are read from the bearer header only when well-formed", () => {
    const token = newToken();
    expect(bearerToken(new Headers({ authorization: `Bearer ${token}` }))).toBe(token);
    expect(bearerToken(new Headers({ authorization: `Bearer ${token}; drop table` }))).toBeNull();
    expect(bearerToken(new Headers({ authorization: "Basic abc" }))).toBeNull();
    expect(bearerToken(new Headers())).toBeNull();
  });
});

describe("visitorPresent", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  it("is true inside the presence window and false after it", () => {
    expect(visitorPresent(new Date(now - 10_000), now)).toBe(true);
    expect(visitorPresent(new Date(now - PRESENCE_MS - 1), now)).toBe(false);
    expect(visitorPresent(null, now)).toBe(false);
  });
});

describe("isHexColor", () => {
  it("accepts six-digit hex only", () => {
    expect(isHexColor("#2E9BE6")).toBe(true);
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("blue")).toBe(false);
  });
});
