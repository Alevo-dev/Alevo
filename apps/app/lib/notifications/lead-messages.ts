/**
 * The org-facing Slack messages for lead milestones (plan.md Sprint 5: qualified
 * lead, meeting booked; hand-off and escalation live in the Qualifier tools) and
 * the fallback when the agent does NOT answer. Pure: `lead-events.ts` loads the
 * records and posts. Tested.
 */

/** The fit score the conversation page calls "Strong fit". */
export const STRONG_FIT = 70;

/** True on the scoring that first takes a lead to a strong fit (never again after). */
export function crossedStrongFit(previous: number | null, next: number): boolean {
  return next >= STRONG_FIT && (previous == null || previous < STRONG_FIT);
}

export type LeadLine = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  channel: string;
  fitScore: number | null;
  scoreReasons: string | null;
  /** Deep link into Alevo, when the app URL is known. */
  link: string | null;
};

function who(lead: LeadLine): string {
  const name = lead.email ? `${lead.name} (${lead.email})` : lead.name;
  return lead.company ? `${name}, ${lead.company}` : name;
}

export function qualifiedLeadMessage(lead: LeadLine): string {
  const lines = [
    `Qualified lead: ${who(lead)} via ${lead.channel}. Fit ${lead.fitScore ?? "?"}/100.`,
    lead.scoreReasons ? `Why: ${lead.scoreReasons}` : null,
    lead.link,
  ];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}

export function meetingBookedMessage(lead: LeadLine, meeting: { when: string | null; joinUrl: string | null }): string {
  const lines = [
    `Meeting booked: ${who(lead)}${meeting.when ? ` — ${meeting.when}` : ""}. Booked by the agent via ${lead.channel}.`,
    meeting.joinUrl ? `Join: ${meeting.joinUrl}` : null,
    lead.link,
  ];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}

/** What broke while booking: reading the calendar, or the booking call itself. */
export type BookingFailure = { step: "availability" | "booking"; detail: string | null };

function reachLine(lead: LeadLine): string {
  const reach = [lead.email, lead.phone].filter((v): v is string => Boolean(v)).join(" · ");
  return reach ? `Reach them: ${reach}` : "No contact details on file; see the conversation.";
}

const BROKE: Record<BookingFailure["step"], string> = {
  availability: "couldn't read the calendar to offer times",
  booking: "couldn't book the time they picked",
};

/**
 * The agent had a qualified lead ready to book and the calendar failed. Says
 * who, what broke (with the calendar's own words), that a person now owes them
 * a time, and how to reach them.
 */
export function bookingFailedMessage(lead: LeadLine, failure: BookingFailure): string {
  const lines = [
    `Booking failed for a qualified lead: ${who(lead)} via ${lead.channel} — the agent ${BROKE[failure.step]}. Fit ${lead.fitScore ?? "?"}/100. Handed to a person.`,
    failure.detail ? `Calendar said: ${failure.detail}` : null,
    reachLine(lead),
    lead.link,
  ];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}

/** The same alert as an email, with the two places to fix it. */
export function bookingFailedEmail(lead: LeadLine, failure: BookingFailure, orgName: string | null): { subject: string; body: string } {
  const where = orgName ? ` (${orgName})` : "";
  const body = [
    `The agent had ${who(lead)} qualified via ${lead.channel} (fit ${lead.fitScore ?? "?"}/100) but ${BROKE[failure.step]}, so the lead is now handed to a person.`,
    failure.detail ? `The calendar said: ${failure.detail}` : null,
    reachLine(lead),
    lead.link ? `Open the conversation: ${lead.link}` : null,
    "Check the calendar under Workspace → Integrations (Manage → Test connection). You can turn these emails off under Workspace → Agent → Notifications.",
  ];
  return { subject: `Booking failed for ${lead.name}${where}`, body: body.filter((l): l is string => Boolean(l)).join("\n\n") };
}

/**
 * The email twin of a Slack post: Slack emoji codes dropped, the first line as
 * the subject (cut at 90 characters).
 */
export function emailFromSlack(text: string): { subject: string; body: string } {
  const body = text.replace(/:[a-z_+-][a-z0-9_+-]*:\s*/g, "").trim();
  const first = body.split("\n")[0]?.trim() ?? "";
  return { subject: first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first, body };
}

/** Why a lead went unanswered. The Qualifier's skip reasons map onto these. */
export type UnansweredReason = "disabled" | "over-allowance" | "suppressed" | "no-reply";

const WHY: Record<UnansweredReason, string> = {
  disabled: "the agent is turned off",
  "over-allowance": "the plan's conversation allowance is used up",
  suppressed: "this contact opted out of email, so the agent can't write to them",
  "no-reply": "the agent hasn't replied",
};

/**
 * The fallback: a lead wrote in and nobody has answered. Says who, why, and how
 * to reach them, so a person can pick it up right away.
 */
export function unansweredLeadMessage(lead: LeadLine, reason: UnansweredReason, after?: string): string {
  const why = reason === "no-reply" && after ? `${WHY[reason]} after ${after}` : WHY[reason];
  const lines = [`Lead needs a person: ${who(lead)} via ${lead.channel} — ${why}.`, reachLine(lead), lead.link];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}
