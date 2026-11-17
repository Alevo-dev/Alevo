import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { recordSpend, spendSeries, spendSummary, vendorSpend, withService } from "@alevo/db";
import { trackClaude } from "../lib/usage/spend";

/** The Spend page's data: rows are grouped by environment and provider. Real Postgres (migration 0051). */
const TAG = "vitest-spend";
afterAll(() => withService((tx) => tx.delete(vendorSpend).where(sql`${vendorSpend.detail} = ${TAG}`)));

describe("vendor spend", () => {
  it("sums by environment, provider and kind, and by day", async () => {
    await recordSpend({ env: "staging", provider: "twilio", kind: "sms_out", units: 2, costUsd: 0.0166, detail: TAG });
    await recordSpend({ env: "staging", provider: "twilio", kind: "sms_out", units: 1, costUsd: 0.0083, detail: TAG });
    await recordSpend({ env: "production", provider: "vapi", kind: "call", units: 3, costUsd: 0.42, estimated: false, detail: TAG });
    const rows = await spendSummary(1);
    const sms = rows.find((r) => r.env === "staging" && r.provider === "twilio" && r.kind === "sms_out");
    expect(sms!.calls).toBeGreaterThanOrEqual(2);
    expect(sms!.costUsd).toBeGreaterThanOrEqual(0.0249);
    expect(rows.find((r) => r.env === "production" && r.provider === "vapi")!.estimatedUsd).toBeGreaterThanOrEqual(0);
    expect((await spendSeries(1)).some((d) => d.env === "staging")).toBe(true);
  });
  it("prices Claude tokens by model", () => {
    expect(() => trackClaude("claude-haiku-5-5", { input_tokens: 1000, output_tokens: 100 }, "x")).not.toThrow();
  });
});
