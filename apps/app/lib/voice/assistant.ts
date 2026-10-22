import "server-only";
import type { OrgProfile } from "@alevo/db";
import { buildVoicePrompt, voiceGreeting, type VoiceMode } from "./prompt";

/** Header Vapi sends back to our server URL with the shared secret (we set it). */
export const VOICE_SECRET_HEADER = "x-alevo-secret";

/** The model the voice agent runs on. Matches the Qualifier's model. */
const VOICE_MODEL = "claude-sonnet-5";

/**
 * Function tools the voice agent can call. Vapi routes these to the assistant's
 * server URL as `tool-calls`. The schema shape follows Vapi's function-tool
 * format; confirm against a live call (see the voice QA checklist).
 */
function tools(bookingConnected: boolean) {
  const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  });

  const base = [
    fn("record_fit_score", "Record how well the caller fits the ideal customer, from 0 (no fit) to 100 (perfect), with a short reason. Call once you can judge.", {
      score: { type: "integer", description: "Fit score from 0 to 100." },
      reasons: { type: "string", description: "One or two sentences grounded in the qualifying criteria." },
    }, ["score", "reasons"]),
    fn("set_status", "Set the lead's status when the call reaches a conclusion. 'handed_off' means a person must follow up. 'disqualified' means not a fit.", {
      status: { type: "string", enum: ["handed_off", "disqualified"] },
      note: { type: "string", description: "Optional short note for the team." },
    }, ["status"]),
    fn("lookup_knowledge", "Look up a specific answer in the business's own knowledge base.", {
      question: { type: "string", description: "The caller's question, in their words." },
    }, ["question"]),
    fn("escalate_to_human", "Hand the call to a person now and notify the team. Use for urgent or sensitive requests.", {
      reason: { type: "string", description: "Why a person needs to step in." },
    }, ["reason"]),
    fn("take_message", "Record the caller's message so the team can follow up.", {
      name: { type: "string" },
      reason: { type: "string", description: "What they need." },
      callback_number: { type: "string", description: "The best number to call them back on." },
    }, ["reason"]),
  ];

  if (!bookingConnected) return base;

  return [
    fn("check_availability", "List open meeting times for the next week. Call before offering a time.", {}),
    fn("book_meeting", "Book a meeting at a slot the caller agreed to. Needs the caller's email.", {
      start: { type: "string", description: "The chosen slot's ISO-8601 start, from check_availability." },
      email: { type: "string", description: "The caller's email address." },
      name: { type: "string", description: "The caller's name." },
    }, ["start", "email"]),
    ...base,
  ];
}

/**
 * Vapi assistant body for an org in a given mode. `appUrl` is the public origin
 * so Vapi can reach `/api/webhooks/vapi`.
 */
export function buildAssistantBody(args: {
  profile: OrgProfile;
  orgName: string;
  mode: VoiceMode;
  bookingConnected: boolean;
  appUrl: string;
  secret: string;
}): Record<string, unknown> {
  const { profile, orgName, mode, bookingConnected, appUrl, secret } = args;
  const company = profile.companyName?.trim() || orgName;
  return {
    name: `${company} (${mode.replace("_", " ")})`,
    firstMessage: voiceGreeting(company, mode, profile.voiceAfterHours),
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "anthropic",
      model: VOICE_MODEL,
      messages: [{ role: "system", content: buildVoicePrompt(profile, mode, bookingConnected) }],
      tools: tools(bookingConnected && mode === "open"),
    },
    server: {
      url: `${appUrl.replace(/\/$/, "")}/api/webhooks/vapi`,
      headers: { [VOICE_SECRET_HEADER]: secret },
    },
    serverMessages: ["assistant-request", "tool-calls", "end-of-call-report"],
    artifactPlan: { recordingEnabled: true },
    maxDurationSeconds: 900,
  };
}
