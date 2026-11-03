/**
 * The end-of-call summary the team reads in the thread. Vapi writes it with this
 * prompt (analysisPlan.summaryPlan); the Claude fallback in
 * lib/qualifier/summarize-call.ts uses the same words. Pure: no imports.
 */
export const CALL_SUMMARY_PROMPT = [
  "Summarise this phone call for the sales team in three to five plain sentences, no headings and no bullet points.",
  "Cover, in order: who called and from where (name, company, location if given); what they need; how good a fit they are and why;",
  "the outcome (meeting booked with the day and time, message taken, handed off to a person, or not a fit);",
  "and the next step for the team. Use only what was said on the call. If the call ended before anything was learned, say so in one sentence.",
].join(" ");

/** Vapi's `analysisPlan` for the assistant body. */
export function summaryPlanFor() {
  return { summaryPlan: { enabled: true, messages: [{ role: "system", content: CALL_SUMMARY_PROMPT }] } };
}
