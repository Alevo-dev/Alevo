import { describe, expect, it } from "vitest";
import { PRICING_EXAMPLES } from "../lib/qualifier/guard";
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
  it("gives examples of what to say about pricing, not one line to repeat", () => {
    expect(PRICING_EXAMPLES.length).toBeGreaterThanOrEqual(3);
    for (const example of PRICING_EXAMPLES) {
      expect(chat()).toContain(example);
      expect(email()).toContain(example);
    }
    expect(chat()).toMatch(/in your own words/i);
    expect(chat()).toMatch(/different way each time/i);
    expect(chat()).not.toContain("I love all of these questions");
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
    expect(buildVoicePrompt({ companyName: "Acme IT" } as never, "open", true)).toContain(PRICING_EXAMPLES[0]);
  });
});

describe("Qualifier prompt: sounds like a person", () => {
  it("asks for plain, warm, human wording", () => {
    const p = chat();
    expect(p).toMatch(/like a real person/i);
    expect(p).toMatch(/contractions/i);
    expect(p).toMatch(/never open with a verdict/i);
  });

  it("bans long dashes and asks for full sentences instead", () => {
    for (const p of [chat(), email()]) {
      expect(p).toMatch(/never use dashes/i);
      expect(p).toMatch(/full sentence/i);
    }
  });

  it("says times in plain words, never a database name like America/New_York", () => {
    expect(chat()).toMatch(/never say a timezone's technical name/i);
  });
});

describe("Qualifier prompt: every question gets an answer", () => {
  it("answers everything the contact asked in the one reply", () => {
    expect(chat()).toMatch(/answer every question/i);
    expect(chat()).toMatch(/limit of one question is about what you ask/i);
  });

  it("answers a second question even in the turn that books the meeting", () => {
    expect(chat("google")).toMatch(/also asked something else/i);
  });

  it("puts the reply and the bookkeeping in the same turn", () => {
    expect(chat()).toMatch(/same turn as reply_to_contact/i);
  });
});

describe("Qualifier prompt: times the agent offers are a sample, not the whole calendar", () => {
  const at = (tz: string | null) =>
    buildSystemPrompt({ ...(profile as object), timezone: tz } as never, contact, [], "google", false, true, false, "", null, new Date("2026-11-17T19:05:00Z"));

  it("tells the agent today's date and weekday in the contact's timezone", () => {
    expect(at("America/New_York")).toContain("Tuesday, 2026-11-17");
    expect(at("America/New_York")).toContain("America/New_York");
  });

  it("uses the local day, not the UTC one, near midnight", () => {
    const p = buildSystemPrompt({ ...(profile as object), timezone: "Asia/Tokyo" } as never, contact, [], "google", false, true, false, "", null, new Date("2026-11-17T19:05:00Z"));
    expect(p).toContain("Wednesday, 2026-11-18");
  });

  it("never calls the offered times the only ones, and looks up the day when another time is asked for", () => {
    const p = at("America/New_York");
    expect(p).toContain("a sample, not every open time");
    expect(p).toContain("never say they are the only times");
    expect(p).toContain("call check_availability with that day");
  });
});

describe("Qualifier prompt: always knows the date and time right now", () => {
  const now = new Date("2026-11-17T19:05:00Z");
  const withMode = (mode: Parameters<typeof buildSystemPrompt>[3], chatChannel: boolean) =>
    buildSystemPrompt({ ...(profile as object), timezone: "America/New_York" } as never, contact, [], mode, !chatChannel, chatChannel, false, "", null, now);

  it.each(["google", "calendly", null] as const)("says it on chat and on email, with the time (mode: %s)", (mode) => {
    for (const chatChannel of [true, false]) {
      const p = withMode(mode, chatChannel);
      expect(p).toContain("Right now it is Tuesday, 2026-11-17, 2:05 PM");
      expect(p).toContain("America/New_York");
    }
  });

  it("is stated once, at the start of the prompt", () => {
    const p = withMode("google", true);
    expect(p.split("Right now it is").length).toBe(2);
    expect(p.indexOf("Right now it is")).toBeLessThan(400);
  });
});

describe("Qualifier prompt: without the contact's timezone it uses the org's and says so", () => {
  const withTz = (contactTz: string | null, orgTz: string | null) =>
    buildSystemPrompt({ ...(profile as object), timezone: orgTz } as never, { ...contact, timezone: contactTz }, [], "google", false, true, false, "", null, new Date("2026-11-17T19:05:00Z"));

  it("assumes the organization's timezone, names the zone with every time, and takes a correction", () => {
    const p = withTz(null, "America/Chicago");
    expect(p).toContain("don't know the contact's timezone");
    expect(p).toContain("assume the organization's timezone (America/Chicago)");
    expect(p).toContain("name the timezone with every time you give");
    expect(p).toContain("another timezone, save it with save_contact_details");
  });

  it("does not ask when their timezone is known", () => {
    const p = withTz("America/Denver", "America/Chicago");
    expect(p).not.toContain("don't know the contact's timezone");
    expect(p).toContain("in the contact's timezone (America/Denver)");
    expect(p).not.toContain("assume the organization's timezone");
  });

  it("never falls back to UTC: with no org timezone either it is Eastern", () => {
    const p = withTz(null, null);
    expect(p).toContain("America/New_York");
    expect(p).not.toContain("(UTC)");
  });
});

describe("Qualifier prompt: only a real calendar booking counts as booked", () => {
  it.each(["google", "calendly", null] as const)("never claims a booking it did not make (mode: %s)", (mode) => {
    const p = chat(mode);
    expect(p).toContain("counts as booked only when book_meeting succeeded");
    expect(p).toContain("say plainly that you couldn't book it");
  });

  it("with no calendar, says it cannot book and hands off", () => {
    const p = chat(null);
    expect(p).toContain("no calendar is connected");
    expect(p).toContain("you can't book it yourself");
    expect(p).toContain("handed_off");
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
