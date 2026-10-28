import { describe, expect, it } from "vitest";
import { isIdempotentMethod, isTransientFetchError, MAX_RETRY_AFTER_MS, retryDelayMs, shouldRetryStatus } from "../lib/http/retry";

describe("shouldRetryStatus", () => {
  it("retries gateway and rate-limit answers for any request", () => {
    for (const s of [429, 502, 503, 504]) {
      expect(shouldRetryStatus(s, false)).toBe(true);
      expect(shouldRetryStatus(s, true)).toBe(true);
    }
  });
  it("retries 500 / 408 / 425 only when replaying is harmless", () => {
    for (const s of [500, 408, 425]) {
      expect(shouldRetryStatus(s, true)).toBe(true);
      expect(shouldRetryStatus(s, false)).toBe(false);
    }
  });
  it("never retries a real answer", () => {
    for (const s of [200, 201, 204, 400, 401, 403, 404, 409, 410, 422]) {
      expect(shouldRetryStatus(s, true)).toBe(false);
    }
  });
});

describe("isIdempotentMethod", () => {
  it("treats reads and replaceable writes as idempotent, POST as not", () => {
    expect(isIdempotentMethod(undefined)).toBe(true);
    expect(isIdempotentMethod("get")).toBe(true);
    expect(isIdempotentMethod("DELETE")).toBe(true);
    expect(isIdempotentMethod("PUT")).toBe(true);
    expect(isIdempotentMethod("POST")).toBe(false);
    expect(isIdempotentMethod("PATCH")).toBe(false);
  });
});

describe("retryDelayMs", () => {
  it("backs off exponentially with full jitter", () => {
    expect(retryDelayMs(1, null, { baseMs: 400, random: () => 1 })).toBe(400);
    expect(retryDelayMs(2, null, { baseMs: 400, random: () => 1 })).toBe(800);
    expect(retryDelayMs(3, null, { baseMs: 400, random: () => 0.5 })).toBe(800);
    expect(retryDelayMs(1, null, { baseMs: 400, random: () => 0 })).toBe(0);
  });
  it("honours Retry-After in seconds or as a date, capped", () => {
    expect(retryDelayMs(1, "2", {})).toBe(2000);
    expect(retryDelayMs(1, "120", {})).toBe(MAX_RETRY_AFTER_MS);
    const now = Date.parse("2026-10-27T12:00:00Z");
    expect(retryDelayMs(1, "Tue, 27 Oct 2026 12:00:03 GMT", { now })).toBe(3000);
    // A date in the past or garbage falls back to backoff.
    expect(retryDelayMs(1, "Tue, 27 Oct 2026 11:00:00 GMT", { now, baseMs: 400, random: () => 1 })).toBe(400);
    expect(retryDelayMs(1, "soon", { baseMs: 400, random: () => 1 })).toBe(400);
  });
});

describe("isTransientFetchError", () => {
  it("recognises timeouts and network drops, not programmer errors", () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    expect(isTransientFetchError(timeout)).toBe(true);
    expect(isTransientFetchError(new TypeError("fetch failed"))).toBe(true);
    expect(isTransientFetchError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isTransientFetchError(new Error("Vapi create assistant failed (400)"))).toBe(false);
    expect(isTransientFetchError("nope")).toBe(false);
  });
});
