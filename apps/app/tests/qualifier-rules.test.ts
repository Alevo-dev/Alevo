import { describe, expect, it } from "vitest";
import { PRICING_REPLY } from "../lib/qualifier/guard";
import { buildSystemPrompt } from "../lib/qualifier/prompt";
import { buildVoicePrompt } from "../lib/voice/prompt";

const profile = {
  companyName: "Acme IT",
  offering: "Managed IT",
  idealCustomer: null,
  qualifyingCriteria: null,
  disqualifiers: null,
  tone: null,
  signoff: null,
} as never;
const contact = { firstName: null, lastName: null, company: null, email: null, phone: null, timezone: null };

const chat = (mode: Parameters<typeof buildSystemPrompt>[3] = "google") =>
  buildSystemPrompt(profile, contact, [], mode, false, true, false, "", null);
const email = () => buildSystemPrompt(profile, contact, [], "google", true, false, false, "", null);

describe("Qualifier prompt: pricing is never discussed", () => {
  it("gives the exact line to use when asked about pricing", () => {
    expect(PRICING_REPLY).toBe(
      "I love all of these questions. Would you be open to having a live discussion with one of our sales reps and they can provide answers?",
    );
    expect(chat()).toContain(PRICING_REPLY);
    expect(email()).toContain(PRICING_REPLY);
  });

  it("forbids quoting prices, even ones found in the knowledge base", () => {
    expect(chat()).toMatch(/never state, estimate/i);
    expect(chat()).toContain("knowledge base");
  });

  it("no longer sends pricing questions to a hand-off", () => {
    for (const mode of ["google", "calendly", null] as const) expect(chat(mode)).not.toMatch(/pricing,|pricing \//i);
  });
});

describe("Qualifier prompt: the goal is a booked appointment", () => {
  it("makes a booked call the goal of every chat", () => {
    expect(chat()).toContain("a booked appointment");
    expect(chat()).toContain("offer to book a call right away");
  });

  it("does not add the chat goal outside chat", () => {
    expect(email()).not.toContain("a booked appointment");
  });
});

describe("Qualifier prompt: one question, always a reply", () => {
  it("allows at most one question per message on real-time channels", () => {
    expect(chat()).toContain("AT MOST ONE question");
  });

  it("never lets the agent skip the reply for bookkeeping", () => {
    const p = chat();
    expect(p).not.toContain("doesn't need a reply");
    expect(p).toContain("is never the whole turn");
  });
});

describe("Voice prompt", () => {
  it("also never discusses pricing", () => {
    expect(buildVoicePrompt({ companyName: "Acme IT" } as never, "open", true)).toContain(PRICING_REPLY);
  });
});
