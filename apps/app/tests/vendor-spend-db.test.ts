import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { conversationSpend, recordSpend, spendByOrg, spendSeries, spendSummary, vendorSpend, withService } from "@alevo/db";
import { claudeCost, claudeSplit } from "../lib/usage/spend";

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
    // Rows with no org land in the "not tied to an organization" group.
    expect((await spendByOrg(1)).some((r) => r.orgId === null && r.env === "production")).toBe(true);
  });
  it("prices Claude tokens by model, with an unknown model at the Sonnet rate", () => {
    const u = { input_tokens: 1_000_000, output_tokens: 1_000_000 };
    expect(claudeCost("claude-haiku-5-5", u)).toBeCloseTo(6);
    expect(claudeCost("claude-sonnet-5", u)).toBeCloseTo(12);
    expect(claudeCost("claude-opus-5-5", u)).toBeCloseTo(90);
    expect(claudeCost("claude-future-9", u)).toBeCloseTo(12);
  });
  it("splits Claude input and output, counting cached input at its own rate", () => {
    const s = claudeSplit("claude-sonnet-5", { input_tokens: 1_000_000, output_tokens: 500_000, cache_read_input_tokens: 1_000_000 });
    expect(s.inputTokens).toBe(2_000_000);
    expect(s.outputTokens).toBe(500_000);
    expect(s.inputCostUsd).toBeCloseTo(2 + 0.2);
    expect(s.outputCostUsd).toBeCloseTo(5);
  });
  it("keeps the input / output split of a row and flags older rows as unsplit", async () => {
    await recordSpend({ env: "development", provider: "anthropic", kind: "agent_turn", units: 150, costUsd: 0.001, detail: TAG, split: { inputTokens: 100, outputTokens: 50, inputCostUsd: 0.0003, outputCostUsd: 0.0007 } });
    await recordSpend({ env: "development", provider: "anthropic", kind: "call_summary", units: 40, costUsd: 0.0002, detail: TAG });
    const rows = await spendSummary(1);
    const withSplit = rows.find((r) => r.kind === "agent_turn" && r.model === TAG)!;
    expect(withSplit.inputTokens).toBeGreaterThanOrEqual(100);
    expect(withSplit.outputCostUsd).toBeGreaterThanOrEqual(0.0007);
    const old = rows.find((r) => r.kind === "call_summary" && r.model === TAG)!;
    expect(old.unsplitUnits).toBeGreaterThanOrEqual(40);
    expect(old.inputTokens).toBe(0);
  });
  it("totals a conversation's AI calls per model, for its org only", async () => {
    const org = crypto.randomUUID();
    const conv = crypto.randomUUID();
    const base = { env: "development" as const, provider: "openai", kind: "agent_turn", orgId: org, conversationId: conv, units: 150, costUsd: 0.0002, detail: TAG };
    await recordSpend({ ...base, split: { inputTokens: 100, outputTokens: 50, inputCostUsd: 0.0001, outputCostUsd: 0.0001 } });
    await recordSpend({ ...base, provider: "anthropic", costUsd: 0.01 });
    await recordSpend({ ...base, kind: "embedding", provider: "voyage" });
    const rows = await conversationSpend(org, conv);
    expect(rows).toHaveLength(1); // both AI rows share the tagged model id; the embedding is not an agent call
    expect(rows[0]!.calls).toBe(2);
    expect(rows[0]!.costUsd).toBeCloseTo(0.0102);
    expect(await conversationSpend(crypto.randomUUID(), conv)).toEqual([]);
  });
});
