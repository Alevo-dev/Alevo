/**
 * The no-reply fallback's pure rules (plan.md risk 9: silent latency). The
 * watchdog in `watchdog.ts` applies them; `tests/lead-messages.test.ts` covers them.
 */

const FAST = process.env.CADENCE_FAST === "1";

/** How long a lead's message may sit without an outbound reply before a person is alerted. */
export const NO_REPLY_AFTER = FAST ? "30s" : "5m";
/** The same wait, as the Slack message says it. */
export const NO_REPLY_LABEL = FAST ? "30 seconds" : "5 minutes";

/**
 * Answered = something went out to the contact after their latest message.
 * No inbound at all counts as answered (nothing to answer).
 */
export function isAnswered(lastInboundAt: Date | null, lastOutboundAt: Date | null): boolean {
  if (!lastInboundAt) return true;
  return lastOutboundAt != null && lastOutboundAt.getTime() >= lastInboundAt.getTime();
}
