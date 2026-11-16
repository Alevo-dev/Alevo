/**
 * The follow-up schedule for a lead that goes quiet after the Qualifier's reply.
 * Standard SDR spacing: three nudges over about a week, then disqualify the lead.
 *
 * Each `after` is the gap since the previous message (the reply or prior nudge).
 * Fast cadence (`CADENCE_FAST=1`, or the switch in the admin console's Settings) collapses it to seconds so the
 * full loop can be tested without waiting days.
 */
export const FOLLOWUPS: ReadonlyArray<{ after: string }> = [{ after: "1d" }, { after: "3d" }, { after: "3d" }];
export const FAST_FOLLOWUPS: ReadonlyArray<{ after: string }> = [{ after: "20s" }, { after: "30s" }, { after: "40s" }];

/** The schedule to run: the real one, or the seconds-long one while fast cadence is on (see `lib/cadence/fast.ts`). */
export const followupSchedule = (fast: boolean) => (fast ? FAST_FOLLOWUPS : FOLLOWUPS);

/**
 * The instruction handed to the Qualifier for a nudge. It's internal context,
 * not a contact message — the Qualifier chooses to send a short follow-up or,
 * if the thread shows the lead is cold or a poor fit, to disqualify instead.
 */
export function followupDirective(attempt: number, isLast: boolean): string {
  const nth = attempt === 0 ? "first" : attempt === 1 ? "second" : "third";
  const base =
    `[Internal instruction — NOT a message from the contact] The contact hasn't ` +
    `replied since your last message. This is automated follow-up ${attempt + 1} ` +
    `(the ${nth}).`;
  if (isLast) {
    return (
      `${base} This is the final follow-up. Send one short, low-pressure message ` +
      `letting them know you'll close this out for now but they're welcome to reply ` +
      `anytime. Do not promise further follow-ups. If they clearly aren't a fit, ` +
      `call set_status('disqualified') instead of replying.`
    );
  }
  return (
    `${base} Send a brief, friendly nudge (one short paragraph, no pressure) that ` +
    `moves the conversation forward. If the lead already looks qualified and booking ` +
    `is available, make the nudge a concrete offer: call check_availability, then ` +
    `propose two or three specific times (or send the booking link). Otherwise gently ` +
    `re-ask your last question. If the thread shows they're not interested or not a ` +
    `fit, call set_status('disqualified') instead of replying.`
  );
}
