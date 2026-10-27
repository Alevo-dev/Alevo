import { eq, inArray } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { funnelByOrg, organizations, orgSubscriptions, plans, withService } from "@alevo/db";
import { notifyInternal } from "@/lib/alerts/internal";
import { slowOrgs, speedDigest } from "@/lib/alerts/speed-digest";
import { ensureActivity, ensureCompany, ensureContact, ensureOpportunity, loadWritebackContext } from "@/lib/psa/writeback";
import { notifyUnansweredLead } from "@/lib/notifications/lead-events";
import { NO_REPLY_AFTER } from "@/lib/qualifier/unanswered";
import { checkUnanswered } from "@/lib/qualifier/watchdog";
import { loadQualifierContext, runQualifier } from "@/lib/qualifier/run";
import { disqualifyStaleConversation, loadCadenceState, runFollowup } from "@/lib/cadence/run";
import { FOLLOWUPS } from "@/lib/cadence/schedule";
import { nextSendTime } from "@/lib/cadence/send-window";
import { ingestDocument } from "@/lib/kb/ingest";
import { recordCall, storeRecording } from "@/lib/voice/process-call";
import {
  inngest,
  type ConversationAwaitingReplyData,
  type ConversationMessageReceivedData,
  type KbDocumentIngestData,
  type OrgProvisionedData,
  type PsaWritebackRequestedData,
  type VoiceCallEndedData,
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
    if ("skip" in ctx) {
      // The agent can't work this lead (off, paused at the plan limit, or the
      // contact opted out of email): a person has to. Alert the org now rather
      // than after the watchdog's wait.
      if (ctx.skip === "disabled" || ctx.skip === "over-allowance" || ctx.skip === "suppressed") {
        await notifyUnansweredLead(orgId, conversationId, ctx.skip);
      }
      return { ok: true, skipped: ctx.skip };
    }

    const result = await runQualifier(ctx);

    // If the Qualifier replied and the lead is still being worked (not
    // disqualified / handed off), start the follow-up cadence. Fired with a
    // plain send (not step.sendEvent) to keep this function stepless; swallowed
    // so a send failure can't trigger a retry that re-runs the agent. A fresh
    // inbound reply cancels the cadence; each subsequent reply emits this again.
    if (
      result.ran &&
      result.replied &&
      !result.booked &&
      (result.status === null || result.status === "active")
    ) {
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

/**
 * KB ingestion. Extracts → chunks → embeds → stores a knowledge-base document
 * so the Qualifier can ground replies in it (plan.md rule 9: heavy work — text
 * extraction + embeddings — runs as an Inngest function).
 *
 * Per-tenant concurrency keyed on `orgId`. Intentionally stepless: ingestion is
 * idempotent (delete-then-insert the doc's chunks), so a retry re-runs cleanly;
 * it also sets its own terminal status (ready / failed) rather than throwing.
 */
export const ingestKbDocument = inngest.createFunction(
  {
    id: "ingest-kb-document",
    concurrency: { key: "event.data.orgId", limit: 2 },
    retries: 2,
    triggers: [{ event: "kb/document.ingest" }],
  },
  async ({ event }) => {
    const { orgId, documentId } = event.data as KbDocumentIngestData;
    const result = await ingestDocument(orgId, documentId);
    return { ok: true, ...result };
  },
);

/**
 * Runs once per finished inbound call (from the Vapi end-of-call report). The
 * recording download is its own step, since it calls a vendor and can retry on
 * its own; if it still fails, the call is recorded without a recording rather
 * than lost. The database writes and alerts are one step after it.
 */
export const processVoiceCall = inngest.createFunction(
  {
    id: "process-voice-call",
    concurrency: { key: "event.data.orgId", limit: 4 },
    retries: 2,
    triggers: [{ event: "voice/call.ended" }],
  },
  async ({ event, step }) => {
    const data = event.data as VoiceCallEndedData;
    const recordingKey = await step.run("store-recording", () => storeRecording(data)).catch((err: unknown) => {
      Sentry.captureException(err);
      return null;
    });
    return step.run("record-call", () => recordCall(data, recordingKey));
  },
);

/**
 * PSA write-back (plan.md Sprint 5). Reacts to a lead becoming qualified and
 * mirrors it into the org's ConnectWise: company → contact → activity, plus an
 * opportunity when a meeting was booked. Each vendor call is its own step so it
 * retries alone; every `ensure*` checks the `psa_links` ledger (then Manage's
 * own search) before creating, so a replay never duplicates a record. Step
 * results hold ids only — the org's keys are decrypted inside each step and
 * never stored by Inngest. One run per org at a time, throttled to be polite
 * to the PSA; orgs without a PSA connected return at the first step.
 */
export const psaWriteback = inngest.createFunction(
  {
    id: "psa-writeback",
    concurrency: { key: "event.data.orgId", limit: 1 },
    throttle: { key: "event.data.orgId", limit: 30, period: "1m" },
    retries: 3,
    triggers: [{ event: "psa/writeback.requested" }],
  },
  async ({ event, step }) => {
    const { orgId, conversationId, reason } = event.data as PsaWritebackRequestedData;

    const ctx = await step.run("load", () => loadWritebackContext(orgId, conversationId));
    if (!ctx) return { ok: true, skipped: "no-psa" };

    const companyId = await step.run("company", () => ensureCompany(ctx));
    const contactId = await step.run("contact", () => ensureContact(ctx, companyId));
    const activityId = await step.run(`activity-${reason}`, () => ensureActivity(ctx, reason, companyId, contactId));
    const opportunityId = reason === "booked" ? await step.run("opportunity", () => ensureOpportunity(ctx, companyId, contactId)) : null;

    return { ok: true, companyId, contactId, activityId, opportunityId };
  },
);

/**
 * Internal speed-to-lead watch (plan.md Sprint 5: "internal alert above ~60s").
 * Once a day, measures every org's first-reply p95 over the last 24 hours and
 * posts the ones over target to Alevo's own alerts channel. Silent when every
 * org is on target, or when the internal webhook isn't configured.
 */
export const speedToLeadWatch = inngest.createFunction(
  { id: "speed-to-lead-watch", retries: 1, triggers: [{ cron: "0 13 * * *" }] },
  async ({ step }) => {
    const slow = await step.run("measure", async () => {
      const funnel = await funnelByOrg(1);
      if (funnel.length === 0) return [];
      const names = await withService((tx) =>
        tx
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, funnel.map((f) => f.orgId))),
      );
      const nameOf = new Map(names.map((n) => [n.id, n.name]));
      return slowOrgs(funnel.map((f) => ({ name: nameOf.get(f.orgId) ?? f.orgId, replied: f.replied, p50: f.p50, p95: f.p95 })));
    });
    const text = speedDigest(slow);
    if (!text) return { ok: true, slow: 0 };
    const result = await step.run("notify", () => notifyInternal(text));
    return { ok: true, slow: slow.length, posted: result.ok, error: result.error };
  },
);

/**
 * The no-reply fallback (plan.md risk 9: silent latency). Every inbound message
 * also starts this: wait `NO_REPLY_AFTER` (5 minutes; `CADENCE_FAST=1` → 30s),
 * then if nothing went out to the contact after their latest message and the
 * lead is still being worked, mark it handed off and tell the org's Slack who
 * to reach. `singleton` per conversation (mode: cancel) so a newer message
 * restarts the clock instead of stacking alerts; the Qualifier's own skips
 * alert immediately and leave this run nothing to do.
 */
export const replyWatchdog = inngest.createFunction(
  {
    id: "reply-watchdog",
    concurrency: { key: "event.data.orgId", limit: 4 },
    singleton: { key: "event.data.conversationId", mode: "cancel" },
    retries: 1,
    triggers: [{ event: "conversation/message.received" }],
  },
  async ({ event, step }) => {
    const { orgId, conversationId } = event.data as ConversationMessageReceivedData;
    await step.sleep("wait-for-reply", NO_REPLY_AFTER);
    return step.run("check", () => checkUnanswered(orgId, conversationId));
  },
);

/** Every Inngest function must be registered in the serve route. */
export const functions = [
  orgProvisioned,
  qualifyConversation,
  conversationCadence,
  ingestKbDocument,
  processVoiceCall,
  psaWriteback,
  speedToLeadWatch,
  replyWatchdog,
];
