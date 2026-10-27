import { describe, expect, it } from "vitest";
import { crossedStrongFit, meetingBookedMessage, qualifiedLeadMessage, unansweredLeadMessage } from "../lib/notifications/lead-messages";
import { isAnswered } from "../lib/qualifier/unanswered";

const lead = {
  name: "Ada Lovelace",
  company: "Acme",
  email: "ada@acme.com",
  phone: "+1 555 0100",
  channel: "Email",
  fitScore: 82,
  scoreReasons: "45 seats, no MSP today",
  link: "https://app.getalevo.com/conversations/abc",
};

describe("crossedStrongFit", () => {
  it("fires once, on the scoring that reaches 70", () => {
    expect(crossedStrongFit(null, 70)).toBe(true);
    expect(crossedStrongFit(55, 82)).toBe(true);
    expect(crossedStrongFit(75, 90)).toBe(false);
    expect(crossedStrongFit(null, 69)).toBe(false);
    expect(crossedStrongFit(80, 40)).toBe(false);
  });
});

describe("messages", () => {
  it("names the lead, the channel and the score, then why, then the link", () => {
    expect(qualifiedLeadMessage(lead)).toBe(
      "Qualified lead: Ada Lovelace (ada@acme.com), Acme via Email. Fit 82/100.\nWhy: 45 seats, no MSP today\nhttps://app.getalevo.com/conversations/abc",
    );
  });
  it("leaves out what it doesn't have", () => {
    expect(qualifiedLeadMessage({ ...lead, company: null, email: null, scoreReasons: null, link: null })).toBe(
      "Qualified lead: Ada Lovelace via Email. Fit 82/100.",
    );
  });
  it("says when the meeting is and how to join", () => {
    expect(meetingBookedMessage(lead, { when: "Oct 28, 2026, 10:00 AM", joinUrl: "https://meet.example/x" })).toBe(
      "Meeting booked: Ada Lovelace (ada@acme.com), Acme — Oct 28, 2026, 10:00 AM. Booked by the agent via Email.\nJoin: https://meet.example/x\nhttps://app.getalevo.com/conversations/abc",
    );
    expect(meetingBookedMessage({ ...lead, link: null }, { when: null, joinUrl: null })).toBe(
      "Meeting booked: Ada Lovelace (ada@acme.com), Acme. Booked by the agent via Email.",
    );
  });
  it("tells a person who to reach and why the agent didn't", () => {
    expect(unansweredLeadMessage(lead, "no-reply", "5 minutes")).toBe(
      "Lead needs a person: Ada Lovelace (ada@acme.com), Acme via Email — the agent hasn't replied after 5 minutes.\nReach them: ada@acme.com · +1 555 0100\nhttps://app.getalevo.com/conversations/abc",
    );
    expect(unansweredLeadMessage({ ...lead, email: null, phone: null, link: null }, "disabled")).toBe(
      "Lead needs a person: Ada Lovelace, Acme via Email — the agent is turned off.\nNo contact details on file; see the conversation.",
    );
    expect(unansweredLeadMessage(lead, "over-allowance")).toContain("the plan's conversation allowance is used up");
  });
});

describe("isAnswered", () => {
  const t = (s: number) => new Date(1_700_000_000_000 + s * 1000);
  it("is answered once something went out after the latest inbound", () => {
    expect(isAnswered(t(0), t(5))).toBe(true);
    expect(isAnswered(t(10), t(5))).toBe(false);
    expect(isAnswered(t(10), null)).toBe(false);
    expect(isAnswered(null, null)).toBe(true);
  });
});
