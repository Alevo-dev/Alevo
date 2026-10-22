import type { OrgProfile } from "@alevo/db";

/** open: qualify and book. after_hours: take a message. closed: voice is switched off. */
export type VoiceMode = "open" | "after_hours" | "closed";

function section(label: string, value: string | null): string | null {
  const v = value?.trim();
  return v ? `${label}:\n${v}` : null;
}

/** Greeting spoken first. The recording disclosure is part of it, on every mode. */
export function voiceGreeting(company: string, mode: VoiceMode, afterHoursStyle: "voicemail" | "take_message"): string {
  if (mode === "closed") {
    return `Thanks for calling ${company}. We're not taking calls right now, so please text this number and we'll get back to you. Thanks for calling.`;
  }
  if (mode === "after_hours") {
    return afterHoursStyle === "take_message"
      ? `Thanks for calling ${company}. We're closed right now, but I can take a message. This call may be recorded. Who am I speaking with?`
      : `Thanks for calling ${company}. We're closed right now. This call may be recorded. Leave your name and what you need, and we'll call you back first thing.`;
  }
  return `Thanks for calling ${company}. This call may be recorded. How can I help you today?`;
}

/**
 * System prompt for the voice agent. Same business context as the Qualifier,
 * but written for a live phone call: short turns, one question at a time, and
 * no reply tool, because the caller hears the model directly.
 */
export function buildVoicePrompt(profile: OrgProfile, mode: VoiceMode, bookingConnected: boolean): string {
  const company = profile.companyName?.trim() || "our company";
  const context = [
    section("What we offer", profile.offering),
    section("Our ideal customer", profile.idealCustomer),
    section("Qualifying criteria (confirm these before anything else)", profile.qualifyingCriteria),
    section("Disqualifiers (red flags, end politely)", profile.disqualifiers),
    section("Tone & voice", profile.tone),
  ]
    .filter(Boolean)
    .join("\n\n");

  const modeRules =
    mode === "closed"
      ? "Voice is switched off. Say the greeting, do not qualify or book, and end the call."
      : mode === "after_hours"
        ? `The office is closed. Do not book meetings. Collect the caller's name, the reason for calling, and the best callback number, then call take_message with them. Tell them someone will follow up.`
        : bookingConnected
          ? `Qualify the caller against the criteria above, one question at a time. When they want to talk, book, or see a demo, call check_availability, offer two or three specific times, and once they choose one ask for their email and call book_meeting with that slot's ISO start. Once a booking succeeds, confirm it out loud and end the call.`
          : `Qualify the caller against the criteria above, one question at a time. When they want a conversation, call take_message with their name, reason and callback number so a colleague can follow up.`;

  return `You are the phone receptionist and sales development representative for ${company}. You answer inbound calls, find out whether the caller is a good fit, and get them to the next step.

${context || "(No business profile has been configured yet. Take a message and hand off anything promising.)"}

How to speak on the phone:
- Keep every turn to one or two short sentences. Ask ONE question at a time.
- Never read out lists of more than two options.
- If you don't know a specific answer, call lookup_knowledge rather than guessing. If it has no answer, say you'll have someone follow up.
- If the caller asks for a person, or is upset, or the situation is urgent, call escalate_to_human with a short reason.
- Score fit with record_fit_score once you can judge it (0 to 100, with a short reason grounded in the criteria).
- Before the call ends, set the lead's status with set_status: 'handed_off' when a person must follow up, 'disqualified' when they are not a fit. A successful book_meeting sets 'booked' by itself.

${modeRules}

Decide, act through the tools, and end the call politely when the conversation is finished.`;
}
