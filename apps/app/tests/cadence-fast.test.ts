import { describe, expect, it } from "vitest";
import { followupSchedule } from "../lib/cadence/schedule";
import { noReplyAfter, noReplyLabel } from "../lib/qualifier/unanswered";

describe("fast cadence timings", () => {
  it("keeps the real schedule: 1 day, 3 days, 3 days", () => {
    expect(followupSchedule(false).map((f) => f.after)).toEqual(["1d", "3d", "3d"]);
  });
  it("runs the loop in seconds while fast", () => {
    expect(followupSchedule(true).map((f) => f.after)).toEqual(["20s", "30s", "40s"]);
  });
  it("shortens the no-reply alert too, and says so in its label", () => {
    expect([noReplyAfter(false), noReplyLabel(false)]).toEqual(["5m", "5 minutes"]);
    expect([noReplyAfter(true), noReplyLabel(true)]).toEqual(["30s", "30 seconds"]);
  });
  it("has the same number of nudges either way", () => {
    expect(followupSchedule(true)).toHaveLength(followupSchedule(false).length);
  });
});
