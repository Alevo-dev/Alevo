import { eq } from "drizzle-orm";
import { orgSubscriptions, plans, withService } from "@alevo/db";
import { loadQualifierContext, runQualifier } from "@/lib/qualifier/run";
import {
  inngest,
  type ConversationMessageReceivedData,
  type OrgProvisionedData,
} from "./client";

/**
 * Runs once per newly-provisioned org (emitted by the Clerk org.created webhook
 * — this REACTS to an org being created; it does not create one). Does the
 * first real onboarding step: give the org a default Starter subscription.
 * Later setup (default settings, etc.) hangs off this event as more steps.
 *
 * Per-tenant concurrency (plan.md rule 10): keyed on `event.data.orgId` so one
 * tenant can never starve others.
 */
export const orgProvisioned = inngest.createFunction(
  {
    id: "org-provisioned",
    concurrency: { key: "event.data.orgId", limit: 1 },
    triggers: [{ event: "org/provisioned" }],
  },
  async ({ event, step }) => {
    const { orgId } = event.data as OrgProvisionedData;

    // A DB write that should retry independently → its own step (rule 10).
    const result = await step.run("seed-default-subscription", () =>
      withService(async (tx) => {
        const [starter] = await tx
          .select({ id: plans.id })
          .from(plans)
          .where(eq(plans.key, "starter"))
          .limit(1);
        if (!starter) throw new Error("Starter plan not seeded (run migration 0002)");

        await tx
          .insert(orgSubscriptions)
          .values({ orgId, planId: starter.id, status: "trialing" })
          .onConflictDoNothing(); // org_id is unique → idempotent on replay

        return { orgId, planId: starter.id };
      }),
    );

    return { ok: true, ...result };
  },
);

/**
 * The Qualifier. Reacts to each inbound message by reading the org's profile +
 * conversation and running the Claude agent, which replies, scores fit, and
 * routes the lead (plan.md rule 9: heavy AI work runs as an Inngest function).
 *
 * Per-tenant concurrency (rule 10) keyed on `orgId`. `retries: 1`: the agent
 * writes replies mid-run, so a retry of a hard failure can at worst duplicate a
 * reply — kept low until we add idempotency keys. Transient API errors are
 * retried in-process by the Anthropic SDK, inside a single attempt.
 */
export const qualifyConversation = inngest.createFunction(
  {
    id: "qualify-conversation",
    concurrency: { key: "event.data.orgId", limit: 2 },
    retries: 1,
    triggers: [{ event: "conversation/message.received" }],
  },
  async ({ event }) => {
    const { orgId, conversationId } = event.data as ConversationMessageReceivedData;

    // Not wrapped in step.run: the context carries Date fields (step memoization
    // JSON-serializes them to strings), and it's a cheap read that's safe to
    // repeat if the function retries.
    const ctx = await loadQualifierContext(orgId, conversationId);
    if (!ctx) return { ok: true, skipped: "not-found" };
    if ("skip" in ctx) return { ok: true, skipped: ctx.skip };

    // The agent loop has interleaved DB side effects, so it is also NOT wrapped
    // in step.run (memoization would replay the writes on retry).
    const result = await runQualifier(ctx);
    return { ok: true, ...result };
  },
);

/** Every Inngest function must be registered in the serve route. */
export const functions = [orgProvisioned, qualifyConversation];
