import { eq } from "drizzle-orm";
import { orgSubscriptions, plans, withService } from "@alevo/db";
import { loadQualifierContext, runQualifier } from "@/lib/qualifier/run";
import { disqualifyStaleConversation, loadCadenceState, runFollowup } from "@/lib/cadence/run";
import { FOLLOWUPS } from "@/lib/cadence/schedule";
import { nextSendTime } from "@/lib/cadence/send-window";
import {
  inngest,
  type ConversationAwaitingReplyData,
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
 *
 * `debounce` per conversation (rule 10) coalesces a burst of inbound messages
 * into one agent run; kept short so it barely dents speed-to-lead. `priority`
 * marks inbound replies as high-priority so they jump ahead of proactive work
 * (cadence nudges, future outbound/KB) once those compete for capacity.
 */
export const qualifyConversation = inngest.createFunction(
  {
    id: "qualify-conversation",
    concurrency: { key: "event.data.orgId", limit: 2 },
    debounce: { key: "event.data.conversationId", period: "8s", timeout: "20s" },
    priority: { run: "120" },
    retries: 1,
    triggers: [{ event: "conversation/message.received" }],
  },
  async ({ event }) => {
    const { orgId, conversationId } = event.data as ConversationMessageReceivedData;

    // Intentionally STEPLESS: the agent loop has interleaved DB writes, so
    // wrapping it in a step would replay those writes if the step retried on a
    // partial failure. With no steps the function runs exactly once per attempt.
    const ctx = await loadQualifierContext(orgId, conversationId);
    if (!ctx) return { ok: true, skipped: "not-found" };
    if ("skip" in ctx) return { ok: true, skipped: ctx.skip };

    const result = await runQualifier(ctx);

    // If the Qualifier replied and the lead is still being worked (not
    // disqualified / handed off), start the follow-up cadence. Fired with a
    // plain send (not step.sendEvent) to keep this function stepless; swallowed
    // so a send failure can't trigger a retry that re-runs the agent. A fresh
    // inbound reply cancels the cadence; each subsequent reply emits this again.
    if (result.ran && result.replied && (result.status === null || result.status === "active")) {
      try {
        await inngest.send({
          name: "conversation/awaiting-reply",
          data: { orgId, conversationId },
        });
      } catch {
        // no cadence this round; the next inbound reply will re-arm it
      }
    }
    return { ok: true, ...result };
  },
);

/**
 * The follow-up cadence. Reacts to `conversation/awaiting-reply` (emitted by the
 * Qualifier after it replies) and nudges a quiet lead on a schedule, then
 * disqualifies them if they never respond (plan.md Sprint 2: send → wait → next
 * action; cancelled on reply; contact-timezone send windows).
 *
 * - `cancelOn` a new inbound message for this conversation: the instant the
 *   contact replies, the whole cadence is torn down (the reply re-runs the
 *   Qualifier, which starts a fresh cadence).
 * - `singleton` per conversation (mode: cancel): only one cadence runs per
 *   conversation; a newer one supersedes an older.
 * - Nudges are proactive outbound, so each is gated to the org's send window in
 *   the contact's timezone — a durable `sleepUntil` holds until the window opens.
 */
export const conversationCadence = inngest.createFunction(
  {
    id: "conversation-cadence",
    concurrency: { key: "event.data.orgId", limit: 2 },
    cancelOn: [{ event: "conversation/message.received", match: "data.conversationId" }],
    singleton: { key: "event.data.conversationId", mode: "cancel" },
    retries: 1,
    triggers: [{ event: "conversation/awaiting-reply" }],
  },
  async ({ event, step }) => {
    const { orgId, conversationId } = event.data as ConversationAwaitingReplyData;

    for (const [i, followup] of FOLLOWUPS.entries()) {
      const isLast = i === FOLLOWUPS.length - 1;
      await step.sleep(`gap-${i}`, followup.after);

      // Re-check right before nudging: a reply, hand-off, disqualification, or a
      // disabled Qualifier all stop the cadence here.
      const state = await step.run(`check-${i}`, () => loadCadenceState(orgId, conversationId));
      if (!state.proceed) return { ok: true, stopped: state.reason };

      // Hold until the next in-window instant in the contact's timezone, then
      // send. (Computed in a step so the deadline is stable across replays.)
      const sendAt = await step.run(`window-${i}`, () =>
        nextSendTime(new Date(), state.timezone, state.startHour, state.endHour).toISOString(),
      );
      await step.sleepUntil(`window-wait-${i}`, new Date(sendAt));

      // Send the nudge inside a step: this function has later steps (more
      // sleeps), so any non-step code here would re-run on every replay and
      // fire the nudge repeatedly. Stepped, it runs once and its result is
      // memoized. A nudge is a single reply, so the retries:1 duplicate-on-
      // partial-failure risk (why the main qualify run is stepless) barely
      // applies. The QualifierResult it returns is plain JSON (no Date fields).
      await step.run(`nudge-${i}`, () => runFollowup(orgId, conversationId, i, isLast));
    }

    // Exhausted the schedule with no reply → disqualify the non-responsive lead.
    await step.run("disqualify-stale", () => disqualifyStaleConversation(orgId, conversationId));
    return { ok: true, stopped: "exhausted" };
  },
);

/** Every Inngest function must be registered in the serve route. */
export const functions = [orgProvisioned, qualifyConversation, conversationCadence];
