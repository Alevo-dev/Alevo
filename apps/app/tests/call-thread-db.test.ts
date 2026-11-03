import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { calls, conversations, organizations, withService } from "@alevo/db";
import { callThread } from "../lib/voice/contact";
import { recordCall, setCallSummary } from "../lib/voice/process-call";
import type { VoiceCallEndedData } from "../lib/inngest/client";

/**
 * One phone call is one conversation. Every webhook message for a call resolves
 * through `callThread(callRef)`: the first creates the conversation and a `calls`
 * stub, the rest find them; the next call from the same number starts a new
 * thread. The end-of-call report fills the stub (never a second row) and a
 * repeated report is a no-op. Real DB; skipped without DATABASE_URL.
 */
const HAS_DB = Boolean(process.env.DATABASE_URL);
const stamp = Date.now();
const PHONE = "+15550000005";
let orgId = "";

const ended = (callRef: string, over: Partial<VoiceCallEndedData> = {}): VoiceCallEndedData => ({
  orgId,
  callRef,
  endedReason: "customer-ended-call",
  startedAt: "2026-11-02T23:00:00.000Z",
  endedAt: "2026-11-02T23:02:30.000Z",
  durationSec: 150,
  summary: "Caller asked about pricing.",
  transcript: "AI: Hello\nUser: Pricing?",
  customerNumber: PHONE,
  toNumber: "+15550000999",
  ...over,
});

beforeAll(async () => {
  if (!HAS_DB) return;
  const [org] = await withService((tx) =>
    tx.insert(organizations).values({ clerkId: `org_test_calls_${stamp}`, name: "Calls test" }).returning({ id: organizations.id }),
  );
  orgId = org!.id;
});

afterAll(async () => {
  if (!HAS_DB || !orgId) return;
  await withService((tx) => tx.delete(organizations).where(eq(organizations.id, orgId)));
});

describe.skipIf(!HAS_DB)("callThread", () => {
  it("is one conversation and one call row per callRef", async () => {
    const first = await callThread(orgId, `ref-a-${stamp}`, PHONE);
    const again = await callThread(orgId, `ref-a-${stamp}`, PHONE);
    expect(again).toEqual(first);
    const rows = await withService((tx) => tx.select({ id: calls.id, conversationId: calls.conversationId }).from(calls).where(eq(calls.providerRef, `ref-a-${stamp}`)));
    expect(rows).toEqual([{ id: first.callId, conversationId: first.conversationId }]);
  });

  it("starts a new conversation for the next call from the same number", async () => {
    const a = await callThread(orgId, `ref-a-${stamp}`, PHONE);
    const b = await callThread(orgId, `ref-b-${stamp}`, PHONE);
    expect(b.contactId).toBe(a.contactId);
    expect(b.conversationId).not.toBe(a.conversationId);
    expect(b.callId).not.toBe(a.callId);
  });

  it("works without a caller number (anonymous contact, still a thread)", async () => {
    const r = await callThread(orgId, `ref-anon-${stamp}`, null);
    expect(r.contactId).toBeTruthy();
    expect(r.conversationId).toBeTruthy();
  });
});

describe.skipIf(!HAS_DB)("recordCall", () => {
  it("fills the stub for a call the webhook already opened, once", async () => {
    const ref = `ref-end-${stamp}`;
    const stub = await callThread(orgId, ref, PHONE);
    await withService((tx) => tx.update(conversations).set({ status: "handed_off" }).where(eq(conversations.id, stub.conversationId)));

    const first = await recordCall(ended(ref), null);
    expect(first).toMatchObject({ ok: true, duplicate: false, outcome: "handed_off" });

    const rows = await withService((tx) => tx.select().from(calls).where(eq(calls.providerRef, ref)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: stub.callId, durationSec: 150, summary: "Caller asked about pricing.", outcome: "handed_off" });
    expect(rows[0]!.endedAt).not.toBeNull();

    const second = await recordCall(ended(ref), null);
    expect(second).toMatchObject({ ok: true, duplicate: true });
  });

  it("creates everything for a call with no tool calls (hung up on the greeting)", async () => {
    const ref = `ref-greet-${stamp}`;
    const r = await recordCall(ended(ref, { durationSec: 4, summary: null }), null);
    expect(r).toMatchObject({ ok: true, duplicate: false, outcome: "none" });
    const [row] = await withService((tx) => tx.select({ conversationId: calls.conversationId, contactId: calls.contactId }).from(calls).where(eq(calls.providerRef, ref)));
    expect(row?.conversationId).toBeTruthy();
    expect(row?.contactId).toBeTruthy();
  });

  it("reports when the record carries no summary, so the fallback runs only for a first report", async () => {
    const ref = `ref-sum-${stamp}`;
    const first = await recordCall(ended(ref, { summary: null }), null);
    expect(first).toMatchObject({ duplicate: false, needsSummary: true });
    expect(await recordCall(ended(ref, { summary: null }), null)).toMatchObject({ duplicate: true });

    await setCallSummary(orgId, ref, "Our own summary.");
    const [row] = await withService((tx) => tx.select({ summary: calls.summary }).from(calls).where(eq(calls.providerRef, ref)));
    expect(row?.summary).toBe("Our own summary.");
  });
});
