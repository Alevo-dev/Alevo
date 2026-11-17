import "server-only";
import { refreshTokenKey } from "@/lib/booking/oauth";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  contacts,
  conversations,
  emailSuppressions,
  messages,
  orgProfiles,
  orgSecrets,
  withService,
  type Channel,
  type ConversationStatus,
  type OrgProfile,
} from "@alevo/db";
import { bookingConfigFromProfile } from "@/lib/booking";
import { DEFAULT_TIMEZONE, isValidTimeZone } from "@/lib/cadence/send-window";
import { contactMessagesNotIn } from "./fresh";
import { trackClaude } from "@/lib/usage/spend";
import { driveAgent, type RunTrace } from "./loop";
import { buildSystemPrompt, type BookingMode, type ContactInfo } from "./prompt";
import {
  BOOKING_TOOLS,
  dispatchTool,
  LINK_BOOKING_TOOLS,
  QUALIFIER_TOOLS,
  type QualifierEffects,
} from "./tools";
import { retrieveKbContext } from "@/lib/kb/retrieve";
import { overAllowance } from "@/lib/usage/limits";

/** The Qualifier runs on Sonnet 5 (near-Opus agentic quality at Sonnet cost). */
const MODEL = "claude-sonnet-5";

export type QualifierContext = {
  orgId: string;
  conversationId: string;
  contactId: string;
  channel: Channel;
  profile: OrgProfile;
  contact: ContactInfo;
  thread: { id?: string; author: "contact" | "assistant" | "human"; body: string }[];
  /** How the Qualifier can book: Cal.com API, Calendly link, or not at all. */
  bookingMode: BookingMode;
  /** Where the conversation stands; a handed-off one is still answered. */
  status: ConversationStatus;
};

export type QualifierResult =
  | { ran: false; skipped: string }
  | ({ ran: true; trace: RunTrace } & QualifierEffects);

/**
 * Load everything the Qualifier needs for one conversation, scoped to the org
 * in code (service path — no RLS). Returns null when there's nothing to act on.
 */
export async function loadQualifierContext(
  orgId: string,
  conversationId: string,
): Promise<QualifierContext | { skip: string } | null> {
  return withService(async (tx) => {
    const [conv] = await tx
      .select({
        channel: conversations.channel,
        status: conversations.status,
        contactId: conversations.contactId,
      })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, orgId)))
      .limit(1);
    if (!conv) return null;
    // No status stops the agent from answering a contact who is still talking (booked, closed, handed off, not a fit):
    // the conversation ends when they say thank you or stop replying. Only the org's own switches below can pause it.

    const [profile] = await tx
      .select()
      .from(orgProfiles)
      .where(eq(orgProfiles.orgId, orgId))
      .limit(1);
    if (!profile) return { skip: "no-profile" };
    if (!profile.enabled) return { skip: "disabled" };
    // Plan limit reached → the agent pauses; the lead sits in the inbox for a person
    // (plan.md §6: nothing is billed automatically, the owner is asked to upgrade).
    if (await overAllowance(orgId, "inbound_conversations")) return { skip: "over-allowance" };

    const [contact] = await tx
      .select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        company: contacts.company,
        email: contacts.email,
        phone: contacts.phone,
        timezone: contacts.timezone,
        contactPreference: contacts.contactPreference,
      })
      .from(contacts)
      .where(and(eq(contacts.id, conv.contactId), eq(contacts.orgId, orgId)))
      .limit(1);

    // Opted out of email + this conversation delivers by email → don't engage at
    // all (no reply to generate, nowhere compliant to send it). SMS conversations
    // aren't gated by email suppression.
    if (conv.channel !== "sms" && contact?.email) {
      const [sup] = await tx
        .select({ id: emailSuppressions.id })
        .from(emailSuppressions)
        .where(
          and(
            eq(emailSuppressions.orgId, orgId),
            sql`lower(${emailSuppressions.email}) = ${contact.email.toLowerCase()}`,
          ),
        )
        .limit(1);
      if (sup) return { skip: "suppressed" };
    }

    const thread = await tx
      .select({ id: messages.id, author: messages.author, body: messages.body })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.orgId, orgId)))
      .orderBy(asc(messages.createdAt));

    // Booking precedence: Cal.com (API key + event type) → a connected calendar
    // (Google / M365, OAuth refresh token present) → Calendly link mode.
    const hasSecret = async (keyName: string) => {
      const [row] = await tx
        .select({ id: orgSecrets.id })
        .from(orgSecrets)
        .where(and(eq(orgSecrets.orgId, orgId), eq(orgSecrets.keyName, keyName)))
        .limit(1);
      return Boolean(row);
    };
    // The org chose one tool (Workspace → Agent → Booking). It only counts
    // once that tool is actually configured; otherwise the agent hands off.
    let bookingMode: BookingMode = null;
    const tool = profile.bookingTool;
    if (tool === "calcom") {
      if (profile.calcomEventTypeId && (await hasSecret("calcom_api_key"))) bookingMode = "calcom";
    } else if (tool === "google" || tool === "m365") {
      if (profile.calendarProvider === tool && profile.calendarId && (await hasSecret(refreshTokenKey(tool)))) bookingMode = tool;
    } else if (tool === "calendly" && profile.calendlyUrl) {
      bookingMode = "calendly";
    }

    return {
      orgId,
      conversationId,
      contactId: conv.contactId,
      channel: conv.channel,
      profile,
      contact: contact ?? {
        firstName: null,
        lastName: null,
        company: null,
        email: null,
        phone: null,
        timezone: null,
      },
      thread,
      bookingMode,
      status: conv.status,
    };
  });
}

/** Map the stored thread to Claude turns (contact → user, assistant/human → assistant). */
function toMessages(thread: QualifierContext["thread"]): Anthropic.MessageParam[] {
  return thread.map((m) => ({
    role: m.author === "contact" ? "user" : "assistant",
    content: m.body,
  }));
}

export type RunQualifierOptions = {
  /**
   * A follow-up instruction for the cadence (not a contact message). Appended as
   * a trailing user turn so the loop runs even though the contact hasn't
   * replied — the Qualifier decides whether to nudge or disqualify.
   */
  directive?: string;
};

/**
 * Run the Qualifier for one conversation: a manual tool-use loop (we drive it so
 * every tool call is gated and recorded, rather than the SDK's auto-runner).
 * Writes replies / score / status through the tools as it goes.
 */
export async function runQualifier(
  ctx: QualifierContext,
  opts: RunQualifierOptions = {},
): Promise<QualifierResult> {
  const messagesForClaude = toMessages(ctx.thread);
  // A cadence nudge has no new contact message, so the thread ends with our own
  // reply. Append the directive as a user turn so the last turn is still a user
  // turn (Sonnet 5 rejects a trailing-assistant prefill) and the loop proceeds.
  if (opts.directive) messagesForClaude.push({ role: "user", content: opts.directive });
  // The event fires on inbound messages, so the latest turn should be the
  // contact's. If it's not (and there's no directive), there's nothing new to
  // answer — skip.
  const last = messagesForClaude.at(-1);
  if (!last || last.role !== "user") return { ran: false, skipped: "awaiting-contact" };

  const client = new Anthropic({ timeout: 90_000, maxRetries: 2 });
  // Ground the reply in the org's knowledge base, keyed on the latest message.
  const query = typeof last.content === "string" ? last.content : "";
  const knowledge = await retrieveKbContext(ctx.orgId, query);
  // Email conversations get the "one complete email" style; SMS/voice/chat stay
  // conversational (one question at a time).
  const emailStyle =
    (ctx.channel === "form" || ctx.channel === "email") && Boolean(ctx.contact.email);
  const system = buildSystemPrompt(ctx.profile, ctx.contact, knowledge, ctx.bookingMode, emailStyle, ctx.channel === "chat", ctx.status === "handed_off", ctx.profile.chatAgentName ?? "", ctx.status);
  // Cal.com / Google / M365 are API booking (slots + book); Calendly is link mode.
  const bookingTools =
    ctx.bookingMode === "calcom" || ctx.bookingMode === "google" || ctx.bookingMode === "m365"
      ? BOOKING_TOOLS
      : ctx.bookingMode === "calendly"
        ? LINK_BOOKING_TOOLS
        : [];
  const tools = [...QUALIFIER_TOOLS, ...bookingTools];
  const contactName =
    [ctx.contact.firstName, ctx.contact.lastName].filter(Boolean).join(" ").trim() ||
    ctx.contact.email ||
    "unknown contact";
  const contactTz = isValidTimeZone(ctx.contact.timezone) ? ctx.contact.timezone : null;
  const orgTz = isValidTimeZone(ctx.profile.timezone) ? ctx.profile.timezone : DEFAULT_TIMEZONE;
  const target = {
    orgId: ctx.orgId,
    conversationId: ctx.conversationId,
    contactId: ctx.contactId,
    channel: ctx.channel,
    contactName,
    contactEmail: ctx.contact.email,
    contactPhone: ctx.contact.phone,
    contactPreference: ctx.contact.contactPreference ?? null,
    contactTimezone: contactTz ?? orgTz,
    timezoneKnown: Boolean(contactTz),
    smsFromNumber: ctx.profile.smsFromNumber,
    bookingConfig: bookingConfigFromProfile(ctx.profile),
    calendlyUrl: ctx.profile.calendlyUrl,
    orgName: ctx.profile.companyName?.trim() || "Alevo",
    businessAddress: ctx.profile.businessAddress,
  };
  const effects: QualifierEffects = {
    replied: false,
    score: null,
    status: null,
    escalated: false,
    booked: false,
    bookingFailed: false,
  };

  // Messages the contact sends while this run works are answered in the same run (a later run would see our reply as
  // the last turn and skip them).
  const known = new Set(ctx.thread.flatMap((m) => (m.id ? [m.id] : [])));
  const trace = await driveAgent(
    messagesForClaude,
    {
      create: async (msgs) => {
        const res = await client.messages.create({
          model: MODEL,
          max_tokens: 8192,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          system,
          messages: msgs,
          tools,
        });
        trackClaude(MODEL, res.usage, "agent_turn", ctx.orgId);
        return res;
      },
      dispatch: (name, input) => dispatchTool(name, input, target, effects),
      fresh: async () => {
        const rows = await contactMessagesNotIn(ctx.orgId, ctx.conversationId, known);
        for (const r of rows) known.add(r.id);
        return rows.map((r) => r.body);
      },
    },
    // A cadence nudge has no contact message to answer; every other run owes the contact a reply.
    { mustReply: !opts.directive },
    effects,
  );

  return { ran: true, trace, ...effects };
}
