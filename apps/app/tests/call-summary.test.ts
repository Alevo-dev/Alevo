import { describe, expect, it } from "vitest";
import { CALL_SUMMARY_PROMPT, summaryPlanFor } from "../lib/voice/summary-prompt";

/**
 * Every call ends with a summary the team can act on. Vapi writes it with our
 * prompt (the saved assistant never produced one); the same prompt drives the
 * Claude fallback when the report arrives empty.
 */
describe("call summary prompt", () => {
  it("asks for the five things the team needs, in plain prose", () => {
    for (const must of ["who called", "what they need", "fit", "outcome", "next step", "no headings"]) {
      expect(CALL_SUMMARY_PROMPT.toLowerCase()).toContain(must);
    }
  });

  it("builds Vapi's analysis plan around that prompt", () => {
    expect(summaryPlanFor()).toEqual({
      summaryPlan: { enabled: true, messages: [{ role: "system", content: CALL_SUMMARY_PROMPT }] },
    });
  });
});
