import { Inngest } from "inngest";

/**
 * Inngest client. In dev it talks to the local Inngest dev server
 * (`npx inngest-cli dev`); in prod the Vercel integration sets INNGEST_EVENT_KEY
 * and INNGEST_SIGNING_KEY.
 *
 * Event payloads carry `orgId` (our uuid) so every function can apply a
 * per-tenant concurrency key (plan.md rule 10).
 */
export const inngest = new Inngest({
  id: "alevo",
  // v4 defaults to cloud mode and no longer infers dev from NODE_ENV. In dev
  // this points the SDK at the local dev server (:8288); in prod it's cloud mode
  // using the signing key the Vercel integration sets.
  isDev: process.env.NODE_ENV !== "production",
});

/** Payload for the baseline provisioning event. */
export type OrgProvisionedData = { orgId: string };

/**
 * Fired whenever a new inbound message lands on a conversation (hosted form, or
 * the "reply as contact" tester today; email/SMS channels later). The Qualifier
 * reacts to this. Carries `orgId` for the per-tenant concurrency key.
 */
export type ConversationMessageReceivedData = { orgId: string; conversationId: string };

/**
 * Fired by the Qualifier after it replies and the lead is still being worked
 * (awaiting the contact). Starts the follow-up cadence, which nudges on a
 * schedule and is cancelled the moment a new inbound message arrives.
 */
export type ConversationAwaitingReplyData = { orgId: string; conversationId: string };

/**
 * Fired when a KB document is created or re-ingested. The ingest function
 * extracts → chunks → embeds → stores. Carries `orgId` for the concurrency key.
 */
export type KbDocumentIngestData = { orgId: string; documentId: string };

/**
 * Fired when Vapi reports an inbound voice call has ended. Carries the fields
 * the webhook already extracted; the recording is fetched by the function.
 */
export type VoiceCallEndedData = {
  orgId: string;
  callRef: string;
  endedReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  summary: string | null;
  transcript: string | null;
  customerNumber: string | null;
  toNumber: string | null;
};

/**
 * Fired when a lead becomes qualified (handed to a person, or a meeting booked)
 * so the org's PSA gets the company, contact, activity and — on a booking — the
 * opportunity. The function is a no-op for orgs without a PSA connected.
 */
export type PsaWritebackRequestedData = { orgId: string; conversationId: string; reason: "handed_off" | "booked" };
