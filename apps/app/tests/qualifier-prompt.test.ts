import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../lib/qualifier/prompt";

const profile = {
  companyName: "Acme IT",
  offering: "Managed IT",
  idealCustomer: null,
  qualifyingCriteria: null,
  disqualifiers: null,
  tone: null,
  signoff: null,
} as never;
const contact = { firstName: "Leo", lastName: null, company: null, email: "leo@example.com", phone: null, timezone: null };

const prompt = (bookingMode: Parameters<typeof buildSystemPrompt>[3], handedOff: boolean) =>
  buildSystemPrompt(profile, contact, [], bookingMode, false, true, handedOff);

describe("Qualifier prompt after a hand-off", () => {
  it("says nothing about a hand-off while the conversation is still being worked", () => {
    expect(prompt("google", false)).not.toContain("ALREADY HANDED OFF");
  });

  it("tells the agent to keep answering after a hand-off, one reply every time", () => {
    const p = prompt("google", true);
    expect(p).toContain("ALREADY HANDED OFF");
    expect(p).toContain("to the best of your ability");
    expect(p).toContain("exactly one reply");
  });

  it("does not re-announce the hand-off", () => {
    expect(prompt("google", true)).toContain("Do not call set_status('handed_off')");
  });

  it("lets a booking request override the hand-off when a calendar is connected", () => {
    const p = prompt("google", true);
    expect(p).toContain("overrides the hand-off");
    expect(p).toContain("check_availability");
    expect(p).toContain("book_meeting");
  });

  it("sends the scheduling link in Calendly mode", () => {
    const p = prompt("calendly", true);
    expect(p).toContain("ALREADY HANDED OFF");
    expect(p).toContain("overrides the hand-off");
    expect(p).toContain("send_booking_link");
  });

  it("with no calendar, confirms a person will set the time instead of promising a booking", () => {
    const p = prompt(null, true);
    expect(p).toContain("ALREADY HANDED OFF");
    expect(p).toContain("a colleague will contact them to set a time");
    expect(p).not.toContain("overrides the hand-off");
  });
});

describe("Qualifier prompt: the chat agent's name", () => {
  const named = (chat: boolean, name: string) => buildSystemPrompt(profile, contact, [], null, false, chat, false, name);

  it("tells the chat agent the name the visitor sees at the top of the window", () => {
    const p = named(true, "Maya");
    expect(p).toContain("Maya");
    expect(p).toContain("at the top of the chat window");
  });

  it("says nothing about a name when none is set", () => {
    expect(named(true, "")).not.toContain("at the top of the chat window");
  });

  it("does not apply the chat name to email, SMS or form conversations", () => {
    expect(named(false, "Maya")).not.toContain("Maya");
  });
});
