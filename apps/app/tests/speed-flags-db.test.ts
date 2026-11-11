import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { contacts, conversations, funnelByOrg, markAgentSkipped, messages, organizations, replyOutcome, withService } from "@alevo/db";
import { flagRunFailure, RUN_FAILED_LABEL } from "@/lib/qualifier/run-failure";

/**
 * Speed to lead and the two flags behind it (migration 0039): a lead the agent
 * could not work is left out of the numbers, and a reply that was written but
 * not delivered is flagged until a later one goes through. Real Postgres.
 */

const ORG = "org_test_speed_flags";
const OTHER = "org_test_speed_flags_other";
let orgId: string;
let otherId: string;
let contactId: string;

/** A conversation received `agoSec` seconds ago, first reply `replySec` after it arrived. */
async function lead(opts: { replySec: number | null; skipped?: "disabled" | "over-allowance" | "suppressed" }) {
  const [row] = await withService((tx) =>
    tx
      .insert(conversations)
      .values({
        orgId,
        contactId,
        channel: "form",
        leadReceivedAt: sql`now() - interval '1 hour'`,
        firstReplySentAt: opts.replySec == null ? null : sql`now() - interval '1 hour' + ${opts.replySec} * interval '1 second'`,
        agentSkipped: opts.skipped ?? null,
      })
      .returning({ id: conversations.id }),
  );
  return row!.id;
}

async function cleanup() {
  await withService((tx) => tx.delete(organizations).where(sql`${organizations.clerkId} in (${ORG}, ${OTHER})`)); // cascades
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at Postgres with migration 0039 applied");
  await cleanup();
  const orgs = await withService((tx) =>
    tx.insert(organizations).values([{ clerkId: ORG, name: "Speed flags" }, { clerkId: OTHER, name: "Speed flags other" }]).returning({ id: organizations.id, clerkId: organizations.clerkId }),
  );
  orgId = orgs.find((o) => o.clerkId === ORG)!.id;
  otherId = orgs.find((o) => o.clerkId === OTHER)!.id;
  const [c] = await withService((tx) => tx.insert(contacts).values({ orgId, email: "speed-flags@example.com" }).returning({ id: contacts.id }));
  contactId = c!.id;
});
afterAll(cleanup);

describe("speed to lead leaves out leads the agent could not work", () => {
  it("counts only worked leads in the median, the 95th percentile and the answered count", async () => {
    await lead({ replySec: 20 });
    await lead({ replySec: 30 });
    await lead({ replySec: 600, skipped: "disabled" }); // agent was off; answered ten minutes later by hand
    const row = (await funnelByOrg(1)).find((f) => f.orgId === orgId)!;
    expect(row.replied).toBe(2);
    expect(row.p50).toBeCloseTo(25, 0);
    expect(row.p95).toBeLessThanOrEqual(30);
  });

  it("still counts an agent-on lead that waited a long time", async () => {
    await lead({ replySec: 3 * 24 * 3600 }); // the agent could have answered; it did not for three days
    const row = (await funnelByOrg(1)).find((f) => f.orgId === orgId)!;
    expect(row.replied).toBe(3);
    expect(row.p95).toBeGreaterThan(3600);
  });
});

describe("markAgentSkipped", () => {
  it("records the first reason and keeps it", async () => {
    const id = await lead({ replySec: null });
    await markAgentSkipped(orgId, id, "disabled");
    await markAgentSkipped(orgId, id, "suppressed");
    const [row] = await withService((tx) => tx.select({ s: conversations.agentSkipped }).from(conversations).where(eq(conversations.id, id)));
    expect(row?.s).toBe("disabled");
  });

  it("only touches a conversation in the org it names", async () => {
    const id = await lead({ replySec: null });
    await markAgentSkipped(otherId, id, "disabled");
    const [row] = await withService((tx) => tx.select({ s: conversations.agentSkipped }).from(conversations).where(eq(conversations.id, id)));
    expect(row?.s).toBeNull();
  });
});

describe("replyOutcome", () => {
  it("is a plain clear when nothing failed", () => {
    expect(replyOutcome(null)).toEqual({ replyFailedAt: null, replyError: null });
  });

  it("flags a failure, and a later good send clears it", async () => {
    const id = await lead({ replySec: 15 });
    const read = async () =>
      (await withService((tx) => tx.select({ at: conversations.replyFailedAt, err: conversations.replyError }).from(conversations).where(eq(conversations.id, id))))[0]!;

    await withService((tx) => tx.update(conversations).set(replyOutcome("Email delivery failed")).where(eq(conversations.id, id)));
    const failed = await read();
    expect(failed.err).toBe("Email delivery failed");
    expect(failed.at).toBeInstanceOf(Date);

    await withService((tx) => tx.update(conversations).set(replyOutcome(null)).where(eq(conversations.id, id)));
    expect(await read()).toEqual({ at: null, err: null });
  });
});

describe("flagRunFailure", () => {
  const say = (id: string, direction: "inbound" | "outbound", offsetSec: number) =>
    withService((tx) =>
      tx.insert(messages).values({
        orgId,
        conversationId: id,
        direction,
        author: direction === "inbound" ? "contact" : "assistant",
        channel: "form",
        body: "x",
        createdAt: sql`now() - interval '1 hour' + ${offsetSec} * interval '1 second'`,
      }),
    );
  const flag = async (id: string) =>
    (await withService((tx) => tx.select({ err: conversations.replyError, first: conversations.firstReplySentAt }).from(conversations).where(eq(conversations.id, id))))[0]!;

  it("flags a lead whose latest message has no reply, and leaves the wait counting", async () => {
    const id = await lead({ replySec: null });
    await say(id, "inbound", 0);
    expect(await flagRunFailure(orgId, id)).toBe(true);
    expect(await flag(id)).toEqual({ err: RUN_FAILED_LABEL, first: null });
  });

  it("does not flag a lead the agent already answered before it crashed", async () => {
    const id = await lead({ replySec: 12 });
    await say(id, "inbound", 0);
    await say(id, "outbound", 12);
    expect(await flagRunFailure(orgId, id)).toBe(false);
    expect((await flag(id)).err).toBeNull();
  });
});
