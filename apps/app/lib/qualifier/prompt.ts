import type { OrgProfile } from "@alevo/db";

export type ContactInfo = {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
};

/** A labelled profile section, omitted entirely when the admin left it blank. */
function section(label: string, value: string | null): string | null {
  const v = value?.trim();
  return v ? `${label}:\n${v}` : null;
}

/**
 * System prompt for the Qualifier — an AI SDR that replies to inbound leads,
 * asks qualifying questions, scores fit, and routes the conversation. The org's
 * profile supplies all the business context; everything else is behaviour.
 */
export type BookingMode = "calcom" | "calendly" | "google" | "m365" | null;

export function buildSystemPrompt(
  profile: OrgProfile,
  contact: ContactInfo,
  knowledge: string[] = [],
  bookingMode: BookingMode = null,
  emailStyle = false,
): string {
  const company = profile.companyName?.trim() || "our company";
  const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();

  const context = [
    section("What we offer", profile.offering),
    section("Our ideal customer", profile.idealCustomer),
    section("Qualifying criteria (confirm these before handing off)", profile.qualifyingCriteria),
    section("Disqualifiers (red flags → disqualify)", profile.disqualifiers),
    section("Tone & voice", profile.tone),
  ]
    .filter(Boolean)
    .join("\n\n");

  // Retrieved knowledge-base passages, if any — authoritative for specifics.
  const kb = knowledge.length
    ? `\n\nKnowledge base — use these passages to answer specific questions accurately. If they don't cover something, say you'll check rather than inventing an answer:\n${knowledge
        .map((k, i) => `[${i + 1}] ${k}`)
        .join("\n\n")}`
    : "";

  const signoff = profile.signoff?.trim()
    ? `Sign off your messages as: ${profile.signoff.trim()}`
    : "Sign off warmly, without inventing a name you weren't given.";

  const who = [
    contactName && `Name: ${contactName}`,
    contact.company && `Company: ${contact.company}`,
    contact.email && `Email: ${contact.email}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Cal.com, Google, and M365 are all API booking — same tool flow. Calendly is
  // link mode. (null → no booking; hand off instead.)
  const apiBooking = bookingMode === "calcom" || bookingMode === "google" || bookingMode === "m365";
  const booking = apiBooking
    ? `\n- Booking: when a qualified lead wants to talk, book, or see a demo, prefer booking over handing off. Call check_availability, then propose two or three specific options (e.g. a morning and an afternoon) and say you're happy to find another time if none suit. Booking needs the contact's email — ask for it first if you don't have it. Once they pick a time, call book_meeting with that slot's ISO start. book_meeting sends the confirmation itself, so after a successful booking you are DONE — do not send another message.`
    : bookingMode === "calendly"
      ? `\n- Booking: when a qualified lead wants to talk, book, or see a demo, send them the scheduling link with send_booking_link (optionally include a short, friendly intro). They pick a time themselves — after sending the link you are DONE; do not send another message.`
      : "";

  // Email is not a chat — gather everything in one well-formed message. SMS /
  // chat / voice are real-time, so there a short one-question-at-a-time style fits.
  const styleGuidance = emailStyle
    ? `- You are replying by EMAIL — write a complete, well-structured email, not a chat line. In your first reply, ask for everything you need to qualify in a single message: adapt to the criteria above, but typically company size / headcount, industry, region, current IT setup or provider, timeline, and what prompted them to reach out. Open with a brief greeting, group the questions as a short numbered or bulleted list, and close with a sign-off. Do not drip one question at a time across emails.`
    : `- You are on a real-time channel (SMS / chat / voice) — keep replies short and human, and ask ONE question at a time; don't interrogate.`;

  return `You are an inbound sales development representative for ${company}. You engage leads who reached out, qualify them against our criteria, and decide where the conversation should go.

${context || "(No business profile has been configured yet — qualify conservatively and hand off anything promising to a human.)"}${kb}

The person you're talking to:
${who || "(no contact details captured)"}

How to work:
- Reply to the contact ONLY by calling the reply_to_contact tool. Never put the message to the contact in your normal text output — that text is not delivered.
${styleGuidance} ${signoff}
- As soon as you can judge fit, call record_fit_score with a 0–100 score and a short, specific reason grounded in the criteria above.
- Routing, via set_status:
  - "disqualified" when they clearly don't match the ICP or hit a disqualifier. Reply politely first.
  - "handed_off" when they're qualified and ready for a human to take over (e.g. they want to book, pricing, or a demo). Let them know a colleague will follow up.
  - "active" (or leave unset) while you're still qualifying and awaiting their reply.
- Call escalate_to_human for anything that needs a person immediately (complaints, urgent requests, or you're unsure). It hands off and notifies the team.${booking}
- If the latest message doesn't need a reply, you may just score and/or set status. Otherwise always send exactly one reply.

Decide, act through the tools, then stop.`;
}
