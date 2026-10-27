import { describe, expect, it } from "vitest";
import {
  activitySummary,
  companyIdentifier,
  companyNameFor,
  connectwiseMissing,
  connectwiseStarted,
  cwAuthorization,
  cwBaseUrl,
  cwQuote,
  LINK_KIND,
  normalizeSite,
  opportunityName,
  splitName,
} from "../lib/psa/connectwise-map";

const has = (...keys: string[]) => (k: string) => keys.includes(k);

describe("connection state", () => {
  const full = { site: "api-na.myconnectwise.net", companyId: "acme", member: "jsmith" };
  it("is connected only with every setting and both keys", () => {
    expect(connectwiseMissing(full, has("connectwise_public_key", "connectwise_private_key"))).toBeNull();
    expect(connectwiseMissing(full, has("connectwise_public_key"))).toBe("private key");
    expect(connectwiseMissing({ ...full, member: null }, has())).toBe("member identifier, public key and private key");
    expect(connectwiseMissing({ site: null, companyId: null, member: null }, has())).toBe(
      "API site, company ID, member identifier, public key and private key",
    );
  });
  it("counts any saved setting as started", () => {
    expect(connectwiseStarted({ site: null, companyId: null, member: null }, has())).toBe(false);
    expect(connectwiseStarted({ site: "x.example.com", companyId: null, member: null }, has())).toBe(true);
    expect(connectwiseStarted({ site: null, companyId: null, member: null }, has("connectwise_private_key"))).toBe(true);
  });
});

describe("request plumbing", () => {
  it("normalizes a pasted URL down to the API host", () => {
    expect(normalizeSite("https://api-na.myconnectwise.net/v4_6_release/apis/3.0/")).toBe("api-na.myconnectwise.net");
    expect(normalizeSite(" API-Staging.ConnectWiseDev.com ")).toBe("api-staging.connectwisedev.com");
    expect(normalizeSite("not a host")).toBeNull();
    expect(normalizeSite("")).toBeNull();
  });
  it("builds the REST base and the Basic header Manage expects", () => {
    expect(cwBaseUrl("api-na.myconnectwise.net")).toBe("https://api-na.myconnectwise.net/v4_6_release/apis/3.0");
    const header = cwAuthorization("acme", "pub", "priv");
    expect(header.startsWith("Basic ")).toBe(true);
    expect(Buffer.from(header.slice(6), "base64").toString("utf8")).toBe("acme+pub:priv");
  });
  it("quotes condition values", () => {
    expect(cwQuote('O"Brien & Co')).toBe('"O\\"Brien & Co"');
  });
});

describe("mapping a lead", () => {
  it("derives a Manage identifier from the company name", () => {
    expect(companyIdentifier("Acme Managed Services, Inc.")).toBe("ACMEMANAGEDSERVICESINC");
    expect(companyIdentifier("A very long company name that keeps on going")).toHaveLength(25);
    expect(companyIdentifier("---")).toBe("ALEVOLEAD");
  });
  it("splits names and falls back to the email", () => {
    expect(splitName("Ada Lovelace", null)).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    expect(splitName("Cher", null)).toEqual({ firstName: "Cher", lastName: "" });
    expect(splitName(null, "ada@acme.com")).toEqual({ firstName: "ada", lastName: "" });
    expect(splitName("  ", null)).toEqual({ firstName: "Lead", lastName: "" });
  });
  it("picks the company: typed, else the work domain, else the person", () => {
    expect(companyNameFor({ company: "Acme", email: "a@x.com", name: "Ada" })).toBe("Acme");
    expect(companyNameFor({ company: null, email: "ada@acme.com", name: "Ada" })).toBe("acme.com");
    expect(companyNameFor({ company: null, email: "ada@gmail.com", name: "Ada" })).toBe("Ada");
  });
  it("writes the activity and opportunity Manage will show", () => {
    const lead = {
      name: "Ada Lovelace",
      company: "Acme",
      channel: "Email",
      fitScore: 82,
      scoreReasons: "45 seats, no MSP today",
      link: "https://app.getalevo.com/conversations/abc",
      meeting: { when: "Oct 28, 2026, 10:00 AM", joinUrl: "https://meet.example/x" },
    };
    const booked = activitySummary("booked", lead);
    expect(booked.name).toBe("Alevo booked a meeting: Ada Lovelace");
    expect(booked.notes).toContain("for Oct 28, 2026, 10:00 AM");
    expect(booked.notes).toContain("Fit score: 82/100.");
    expect(booked.notes).toContain("Join link: https://meet.example/x");
    const handed = activitySummary("handed_off", { ...lead, meeting: null, fitScore: null });
    expect(handed.name).toBe("Alevo handed off a lead: Ada Lovelace");
    expect(handed.notes).not.toContain("Fit score");
    expect(opportunityName(lead)).toBe("Acme — inbound via Alevo (Ada Lovelace)");
    expect(LINK_KIND.activity("booked")).toBe("activity:booked");
  });
});
