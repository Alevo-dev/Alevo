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

describe("Qualifier prompt: a lead marked not a fit can turn out to fit", () => {
  const notAFit = (mode: Parameters<typeof buildSystemPrompt>[3]) =>
    buildSystemPrompt(profile, contact, [], mode, false, true, false, "", "disqualified");

  it("reopens the conversation and re-scores when they now match", () => {
    const p = notAFit("google");
    expect(p).toContain('set_status "active"');
    expect(p).toContain("record_fit_score with the new score");
  });

  it("books them when a calendar is connected, overriding the earlier verdict", () => {
    const p = notAFit("google");
    expect(p).toContain("a request to book overrides the earlier verdict");
    expect(p).toContain("check_availability");
    expect(p).toContain("book_meeting");
  });

  it("sends the scheduling link in link mode", () => {
    expect(notAFit("calendly")).toContain("send_booking_link");
  });

  it("promises a colleague's call and hands off when there is no calendar", () => {
    const p = notAFit(null);
    expect(p).toContain("a colleague will contact them");
    expect(p).toContain("handed_off");
  });
});

describe("Qualifier prompt: the status is a live label, whatever it is now", () => {
  const withStatus = (status: string | null) =>
    buildSystemPrompt(profile, contact, [], "google", false, true, status === "handed_off", "", status);

  it.each([null, "active", "handed_off", "disqualified", "closed", "booked"])("re-judges it on every message (status: %s)", (status) => {
    const p = withStatus(status);
    expect(p).toContain("live label, not a verdict");
    expect(p).toContain("change it with set_status");
  });

  it("tells the agent to act on the new status straight away", () => {
    expect(withStatus("disqualified")).toContain("act on the new status at once");
  });

  it("keeps a booked meeting booked and sends meeting changes to a colleague", () => {
    expect(withStatus("booked")).toContain("already has a meeting booked stays booked");
  });
});
