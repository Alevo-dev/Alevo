import "server-only";
import type { OrgProfile } from "@alevo/db";
import { CONTACT_DETAILS_TOOL } from "@/lib/contact-details";
import { bookingOnCall, buildVoicePrompt, voiceGreeting, type VoiceMode } from "./prompt";

/** Header Vapi sends back to our server URL with the shared secret (we set it). */
export const VOICE_SECRET_HEADER = "x-alevo-secret";

/** Where Vapi posts assistant-request, tool-calls and end-of-call-report. */
export function voiceServerUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/vapi`;
}

/** The model the voice agent runs on. Matches the Qualifier's model. */
const VOICE_MODEL = "claude-sonnet-5";

/**
 * Function tools the voice agent can call. Vapi routes these to the assistant's
 * server URL as `tool-calls`. The schema shape follows Vapi's function-tool
 * format; confirm against a live call (see the voice QA checklist).
 */
/**
 * How a tool sounds on the call. Vapi speaks a stock filler ("hang on a sec", "one
 * moment") at the start of every synchronous tool call unless the tool brings its
 * own `request-start` message — three bookkeeping calls in a row became three
 * fillers. So: tools whose result the agent needs say ONE natural line (`say`);
 * pure bookkeeping runs `async` — the model moves on without waiting, and no
 * filler is spoken at all.
 */
type Sound = { say: string } | { async: true };

function tools(canBook: boolean) {
  const fn = (
    name: string,
    description: string,
    properties: Record<string, unknown>,
    required: string[],
    sound: Sound,
  ) => ({
    type: "function",
    ..."async" in sound
      ? { async: true }
      : { messages: [{ type: "request-start", content: sound.say }] },
    function: { name, description, parameters: { type: "object", properties, required } },
  });

  const base = [
    fn(CONTACT_DETAILS_TOOL.name, CONTACT_DETAILS_TOOL.description, CONTACT_DETAILS_TOOL.properties, [], { async: true }),
    fn("record_fit_score", "Record how well the caller fits the ideal customer, from 0 (no fit) to 100 (perfect), with a short reason. Call once you can judge.", {
      score: { type: "integer", description: "Fit score from 0 to 100." },
      reasons: { type: "string", description: "One or two sentences grounded in the qualifying criteria." },
    }, ["score", "reasons"], { async: true }),
    fn("set_status", "Set the lead's status when the call reaches a conclusion. 'handed_off' means a person must follow up. 'disqualified' means not a fit.", {
      status: { type: "string", enum: ["handed_off", "disqualified"] },
      note: { type: "string", description: "Optional short note for the team." },
    }, ["status"], { async: true }),
    fn("lookup_knowledge", "Look up a specific answer in the business's own knowledge base.", {
      question: { type: "string", description: "The caller's question, in their words." },
    }, ["question"], { say: "Let me check that for you." }),
    fn("escalate_to_human", "Hand the call to a person now and notify the team. Use for urgent or sensitive requests.", {
      reason: { type: "string", description: "Why a person needs to step in." },
    }, ["reason"], { say: "Let me get someone for you." }),
    fn("take_message", "Record the caller's message so the team can follow up.", {
      name: { type: "string" },
      reason: { type: "string", description: "What they need." },
      callback_number: { type: "string", description: "The best number to call them back on." },
    }, ["reason"], { say: "Give me a few seconds while I get that noted down." }),
  ];

  if (!canBook) return base;

  return [
    fn("check_availability", "List open meeting times for the next week. Call before offering a time.", {}, [], {
      say: "Let me pull up the calendar, one moment.",
    }),
    fn("book_meeting", "Book a meeting at a slot the caller agreed to. Needs the caller's email.", {
      start: { type: "string", description: "The chosen slot's ISO-8601 start, from check_availability." },
      email: { type: "string", description: "The caller's email address." },
      name: { type: "string", description: "The caller's name." },
    }, ["start", "email"], { say: "Great, give me a few seconds while I get that booked." }),
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
  const canBook = bookingOnCall(mode, profile.voiceAfterHours, bookingConnected);
  return {
    name: `${company} (${mode.replace("_", " ")})`,
    firstMessage: voiceGreeting(company, mode, profile.voiceAfterHours, canBook),
    firstMessageMode: "assistant-speaks-first",
    // Deepgram's newest model: noticeably better on names and numbers than the default.
    transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
    model: {
      provider: "anthropic",
      model: VOICE_MODEL,
      messages: [{ role: "system", content: buildVoicePrompt(profile, mode, bookingConnected) }],
      tools: tools(canBook),
    },
    server: {
      url: voiceServerUrl(appUrl),
      headers: { [VOICE_SECRET_HEADER]: secret },
    },
    // "assistant-request" is NOT an assistant-level message: Vapi sends it from the
    // phone number's server URL (see importTwilioNumber) before an assistant exists.
    serverMessages: ["tool-calls", "end-of-call-report"],
    // Gives the model an endCall tool, so it can hang up after the goodbye instead
    // of waiting for the caller to.
    endCallFunctionEnabled: true,
    artifactPlan: { recordingEnabled: true },
    maxDurationSeconds: 900,
  };
}
