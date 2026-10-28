import { describe, expect, it } from "vitest";
import { calendarTestDetail, calendarTestHint } from "../lib/booking/calendar-test";
import { formatVendorError } from "../lib/http/vendor-error";

describe("formatVendorError", () => {
  it("lifts Google's error.message next to the status", () => {
    const body = { error: { code: 403, message: "Google Calendar API has not been used in project 1 before or it is disabled." } };
    expect(formatVendorError("Google free/busy", 403, body)).toBe(
      "Google free/busy failed (403): Google Calendar API has not been used in project 1 before or it is disabled.",
    );
  });
  it("prefers OAuth error_description, then a string error, then message", () => {
    expect(formatVendorError("Token", 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." })).toContain(
      "Token has been expired or revoked.",
    );
    expect(formatVendorError("Token", 400, { error: "invalid_grant" })).toBe("Token failed (400): invalid_grant");
    expect(formatVendorError("Graph", 401, { message: "nope" })).toBe("Graph failed (401): nope");
  });
  it("falls back to the status alone for empty or unreadable bodies", () => {
    expect(formatVendorError("X", 502, null)).toBe("X failed (502)");
    expect(formatVendorError("X", 502, "")).toBe("X failed (502)");
    expect(formatVendorError("X", 502, "<html>bad gateway</html>")).toBe("X failed (502): <html>bad gateway</html>");
  });
});

describe("calendarTestHint", () => {
  it("names the Google Cloud fix for a disabled Calendar API", () => {
    expect(calendarTestHint("Google free/busy failed (403): Google Calendar API has not been used in project 886 before or it is disabled.")).toMatch(
      /Enable the Google Calendar API/,
    );
  });
  it("suggests a reconnect for a dead refresh token or missing permission", () => {
    expect(calendarTestHint("Token has been expired or revoked.")).toMatch(/Disconnect, then connect/);
    expect(calendarTestHint("Graph calendarView failed (403): ErrorAccessDenied")).toMatch(/accept every permission/);
  });
  it("has nothing to add for an unknown error", () => {
    expect(calendarTestHint("Google free/busy failed (500)")).toBeNull();
  });
});

describe("calendarTestDetail", () => {
  it("reads naturally for many, one and no slots", () => {
    expect(calendarTestDetail("Google Calendar", "a@b.co", 14, 30)).toBe(
      "Reached Google Calendar for a@b.co: 14 open 30-minute slots in the next 72 hours.",
    );
    expect(calendarTestDetail("Microsoft 365", null, 1, 45)).toBe("Reached Microsoft 365: 1 open 45-minute slot in the next 72 hours.");
    expect(calendarTestDetail("Microsoft 365", null, 0, 30)).toBe("Reached Microsoft 365: no open 30-minute slots in the next 72 hours.");
  });
});
