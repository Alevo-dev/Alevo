import type { OrgProfile } from "@alevo/db";

/** open: qualify and book. after_hours: take a message (and book, if a calendar is connected). closed: voice is switched off. */
export type VoiceMode = "open" | "after_hours" | "closed";

export type AfterHoursStyle = "voicemail" | "take_message";

/**
 * Whether this call can book: open calls always; after hours only when the org
 * takes details (not plain voicemail). Booking is the goal, and a lead who calls
 * at 7pm can still be put on tomorrow's calendar.
 */
export function bookingOnCall(mode: VoiceMode, afterHours: AfterHoursStyle, bookingConnected: boolean): boolean {
  if (!bookingConnected || mode === "closed") return false;
  return mode === "open" || afterHours === "take_message";
}

const QUALIFY_AND_BOOK = `Qualify the caller against the criteria above, one question at a time. Booking is the goal: as soon as the caller is a fit (the criteria check out and the call is going well), don't wait to be asked — say you'd like to get them a proper call with the team and offer times. Call check_availability (it returns open times in the next day or three), then offer two of them by day and time; if neither suits, offer the others. Once they choose, ask for their email and call book_meeting with that slot's ISO start. Once a booking succeeds, confirm the day and time out loud, then wrap up. If nothing works, call take_message so a colleague can find a time.`;

function section(label: string, value: string | null): string | null {
  const v = value?.trim();
  return v ? `${label}:\n${v}` : null;
}

/** Greeting spoken first. The recording disclosure is part of it, on every mode. */
export function voiceGreeting(company: string, mode: VoiceMode, afterHoursStyle: AfterHoursStyle, canBook: boolean): string {
  if (mode === "closed") {
    return `Thanks for calling ${company}. We're not taking calls right now, so please text this number and we'll get back to you. Thanks for calling.`;
  }
  if (mode === "after_hours") {
    if (canBook) {
      return `Thanks for calling ${company}. We're closed right now, but I can still help and get you a time with the team. This call may be recorded. Who am I speaking with?`;
    }
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

  const canBook = bookingOnCall(mode, profile.voiceAfterHours, bookingConnected);
  const modeRules =
    mode === "closed"
      ? "Voice is switched off. Say the greeting, do not qualify or book, and call endCall."
      : mode === "after_hours"
        ? canBook
          ? `The office is closed, so nobody can take the call right now — say so once, then carry on: ${QUALIFY_AND_BOOK} Any meeting you book is during office hours, so the team will be there.`
          : `The office is closed. Do not book meetings. Collect the caller's name, the reason for calling, and the best callback number, then call take_message with them. Tell them someone will follow up.`
        : canBook
          ? QUALIFY_AND_BOOK
          : `Qualify the caller against the criteria above, one question at a time. Booking is the goal even without a calendar: as soon as the caller is a fit, say a colleague will call back within one business day to set up a time, and call take_message with their name, reason and callback number.`;

  return `You are the phone receptionist and sales development representative for ${company}. You answer inbound calls, find out whether the caller is a good fit, and get the good ones booked onto a call with the team before you hang up.

${context || "(No business profile has been configured yet. Take a message and hand off anything promising.)"}

How to speak on the phone:
- Keep every turn to one or two short sentences. Ask ONE question at a time.
- Never read out lists of more than two options.
- Get the caller's name early. Names are hard to hear on the phone: if you're unsure, ask them to spell it, repeat it back once, and move on. Never ask for it more than twice.
- As soon as you learn the caller's name, email or company, call save_contact_details so the team sees who called.
- When you need a moment to save, book or look something up, say so ONCE in your own words ("give me a few seconds while I get that entered"), then say nothing until it's done. Never repeat "hang on" or "one moment"; never narrate the steps.
- Wrapping up: when the booking or message is done, ask "Is there anything else I can help you with?". If not, thank them for calling, say goodbye, and call endCall. You end the call — never leave the caller waiting for you to hang up.
- If you don't know a specific answer, call lookup_knowledge rather than guessing. If it has no answer, say you'll have someone follow up.
- If the caller asks for a person, or is upset, or the situation is urgent, call escalate_to_human with a short reason.
- Score fit with record_fit_score once you can judge it (0 to 100, with a short reason grounded in the criteria).
- Before the call ends, set the lead's status with set_status: 'handed_off' when a person must follow up, 'disqualified' when they are not a fit. A successful book_meeting sets 'booked' by itself.

${modeRules}

Decide, act through the tools, and when the conversation is finished wrap up and call endCall.`;
}
