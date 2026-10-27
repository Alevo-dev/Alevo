import { describe, expect, it } from "vitest";
import { readLeadFields, validateLead } from "../lib/leads/fields";
import { clientIp, ipKey, MIN_FILL_MS, parseStartedAt, spamReason } from "../lib/leads/spam";

const NOW = 1_800_000_000_000;

describe("validateLead", () => {
  it("requires name, email and consent", () => {
    expect(
      validateLead({
        name: "",
        email: "",
        phone: "",
        company: "",
        message: "",
        consent: false,
      }),
    ).toEqual({
      name: "Name is required.",
      email: "Email is required.",
      consent: "Please confirm you agree to be contacted.",
    });
  });
  it("rejects a malformed email and accepts a good one", () => {
    const base = {
      name: "Pat",
      phone: "",
      company: "",
      message: "",
      consent: true,
    };
    expect(validateLead({ ...base, email: "pat@" }).email).toBe("Enter a valid email address.");
    expect(validateLead({ ...base, email: "pat@example.com" })).toEqual({});
  });
});

describe("readLeadFields", () => {
  it("trims, caps and reads consent from JSON booleans and form strings", () => {
    const fromJson = readLeadFields((n) => ({ name: "  Pat Lee ", email: "PAT@EXAMPLE.COM", consent: true })[n]);
    expect(fromJson.name).toBe("Pat Lee");
    expect(fromJson.consent).toBe(true);
    const fromForm = readLeadFields((n) => ({ name: "x".repeat(300), consent: "yes", website: "http://spam" })[n]);
    expect(fromForm.name).toHaveLength(200);
    expect(fromForm.consent).toBe(true);
    expect(fromForm.honeypot).toBe("http://spam");
    expect(readLeadFields(() => undefined).consent).toBe(false);
  });
});

describe("spam checks", () => {
  it("flags a filled honeypot", () => {
    expect(spamReason({ honeypot: "http://x", startedAt: NOW - 60_000, now: NOW })).toBe("honeypot");
  });
  it("flags a submit faster than a human could fill the form", () => {
    expect(
      spamReason({
        honeypot: "",
        startedAt: NOW - (MIN_FILL_MS - 1),
        now: NOW,
      }),
    ).toBe("too_fast");
    expect(spamReason({ honeypot: "", startedAt: NOW - MIN_FILL_MS, now: NOW })).toBeNull();
  });
  it("lets a submission without timing through (plain HTML forms have none)", () => {
    expect(spamReason({ honeypot: "", startedAt: null, now: NOW })).toBeNull();
  });
  it("parses started-at and ignores garbage or stale values", () => {
    expect(parseStartedAt(String(NOW - 5_000), NOW)).toBe(NOW - 5_000);
    expect(parseStartedAt("abc", NOW)).toBeNull();
    expect(parseStartedAt("-5", NOW)).toBeNull();
    expect(parseStartedAt(String(NOW - 2 * 24 * 60 * 60 * 1000), NOW)).toBeNull();
  });
  it("reads the client IP from the first forwarded hop and hashes it for the key", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
    const key = ipKey("lead_form", "203.0.113.9");
    expect(key).toMatch(/^lead_form:ip:[0-9a-f]{32}$/);
    expect(key).not.toContain("203.0.113.9");
  });
});
