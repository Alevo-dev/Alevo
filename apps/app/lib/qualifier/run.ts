import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq } from "drizzle-orm";
import {
  contacts,
  conversations,
  messages,
  orgProfiles,
  withService,
  type Channel,
  type ConversationStatus,
  type OrgProfile,
} from "@alevo/db";
import { buildSystemPrompt, type ContactInfo } from "./prompt";
import { dispatchTool, QUALIFIER_TOOLS, type QualifierEffects } from "./tools";

/** The Qualifier runs on Sonnet 5 (near-Opus agentic quality at Sonnet cost). */
const MODEL = "claude-sonnet-5";
/** Guard against a runaway tool loop; a normal turn is 1–2 iterations. */
const MAX_TURNS = 6;
/** Conversations the Qualifier should never touch. */
const TERMINAL: ReadonlySet<ConversationStatus> = new Set(["booked", "closed"]);

export type QualifierContext = {
  orgId: string;
  conversationId: string;
  channel: Channel;
  profile: OrgProfile;
  contact: ContactInfo;
  thread: { author: "contact" | "assistant" | "human"; body: string }[];
};

export type QualifierResult =
  | { ran: false; skipped: string }
  | ({ ran: true } & QualifierEffects);

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
    if (TERMINAL.has(conv.status)) return { skip: `status:${conv.status}` };

    const [profile] = await tx
      .select()
      .from(orgProfiles)
      .where(eq(orgProfiles.orgId, orgId))
      .limit(1);
    if (!profile) return { skip: "no-profile" };
    if (!profile.enabled) return { skip: "disabled" };

    const [contact] = await tx
      .select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        company: contacts.company,
        email: contacts.email,
      })
      .from(contacts)
      .where(and(eq(contacts.id, conv.contactId), eq(contacts.orgId, orgId)))
      .limit(1);

    const thread = await tx
      .select({ author: messages.author, body: messages.body })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.orgId, orgId)))
      .orderBy(asc(messages.createdAt));

    return {
      orgId,
      conversationId,
      channel: conv.channel,
      profile,
      contact: contact ?? { firstName: null, lastName: null, company: null, email: null },
      thread,
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

  const client = new Anthropic();
  const system = buildSystemPrompt(ctx.profile, ctx.contact);
  const contactName =
    [ctx.contact.firstName, ctx.contact.lastName].filter(Boolean).join(" ").trim() ||
    ctx.contact.email ||
    "unknown contact";
  const target = {
    orgId: ctx.orgId,
    conversationId: ctx.conversationId,
    channel: ctx.channel,
    contactName,
    contactEmail: ctx.contact.email,
    orgName: ctx.profile.companyName?.trim() || "Alevo",
  };
  const effects: QualifierEffects = { replied: false, score: null, status: null, escalated: false };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      messages: messagesForClaude,
      tools: QUALIFIER_TOOLS,
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0) break; // end_turn — the Qualifier is done

    // Preserve the full assistant turn (incl. thinking blocks) before replying.
    messagesForClaude.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      const content = await dispatchTool(
        call.name,
        (call.input ?? {}) as Record<string, unknown>,
        target,
        effects,
      );
      results.push({ type: "tool_result", tool_use_id: call.id, content });
    }
    messagesForClaude.push({ role: "user", content: results });
  }

  return { ran: true, ...effects };
}
