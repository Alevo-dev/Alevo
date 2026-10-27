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
  const reach = [lead.email, lead.phone].filter((v): v is string => Boolean(v)).join(" · ");
  const lines = [
    `Lead needs a person: ${who(lead)} via ${lead.channel} — ${why}.`,
    reach ? `Reach them: ${reach}` : "No contact details on file; see the conversation.",
    lead.link,
  ];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
}
