import type Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { conversations, messages, withService, type Channel } from "@alevo/db";
import { notifySlack } from "@/lib/notifications/slack";
import { isEmailConfigured, sendQualifierEmail } from "@/lib/email/resend";

/** Statuses the Qualifier is allowed to set (booking needs a calendar — later). */
const SETTABLE_STATUS = ["active", "disqualified", "handed_off"] as const;
type SettableStatus = (typeof SETTABLE_STATUS)[number];

/** Claude tool surface for the Qualifier (MVP: reply, score, route, escalate). */
export const QUALIFIER_TOOLS: Anthropic.Tool[] = [
  {
    name: "reply_to_contact",
    description:
      "Send a message to the contact. This is the ONLY way to deliver text to them. Use once per turn when a reply is warranted.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to send to the contact." },
      },
      required: ["message"],
    },
  },
  {
    name: "record_fit_score",
    description:
      "Record how well this lead fits the ideal customer profile, 0 (no fit) to 100 (perfect fit), with a short reason.",
    input_schema: {
      type: "object",
      properties: {
        score: { type: "integer", description: "Fit score from 0 to 100." },
        reasons: { type: "string", description: "One or two sentences justifying the score." },
      },
      required: ["score", "reasons"],
    },
  },
  {
    name: "set_status",
    description:
      "Route the conversation: 'disqualified' (not a fit), 'handed_off' (qualified, ready for a human), or 'active' (still qualifying).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...SETTABLE_STATUS] },
        note: { type: "string", description: "Optional internal note about the decision." },
      },
      required: ["status"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand the conversation to a human now and notify the team. Use for urgent, sensitive, or unclear situations.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why a human needs to step in." },
      },
      required: ["reason"],
    },
  },
];

/** What the Qualifier did this turn — surfaced in the Inngest result + logs. */
export type QualifierEffects = {
  replied: boolean;
  score: number | null;
  status: SettableStatus | null;
  escalated: boolean;
};

export type DispatchTarget = {
  orgId: string;
  conversationId: string;
  channel: Channel;
  contactName: string;
  contactEmail: string | null;
  orgName: string;
};

const clampScore = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;

/** Scope every write to this org + conversation (service path has no RLS). */
function scoped(target: DispatchTarget) {
  return and(
    eq(conversations.id, target.conversationId),
    eq(conversations.orgId, target.orgId),
  );
}

/**
 * Execute one Claude tool call against the DB and return the text result Claude
 * sees. All writes go through the service path, scoped to the org in code.
 */
export async function dispatchTool(
  name: string,
  input: Record<string, unknown>,
  target: DispatchTarget,
  effects: QualifierEffects,
): Promise<string> {
  switch (name) {
    case "reply_to_contact": {
      const body = String(input.message ?? "").trim();
      if (!body) return "Error: message was empty; nothing was sent.";

      // Deliver by email when we have an address and email is configured;
      // otherwise just record the reply in-app (dev / no-email fallback).
      let channel: Channel = target.channel;
      let providerRef: string | null = null;
      let note = "recorded in-app (no email configured)";

      if (target.contactEmail && isEmailConfigured()) {
        // Thread the reply into the lead's inbox via the last inbound message id.
        const [lastInbound] = await withService((tx) =>
          tx
            .select({ ref: messages.providerRef })
            .from(messages)
            .where(
              and(
                eq(messages.conversationId, target.conversationId),
                eq(messages.orgId, target.orgId),
                eq(messages.direction, "inbound"),
                isNotNull(messages.providerRef),
              ),
            )
            .orderBy(desc(messages.createdAt))
            .limit(1),
        );
        const sent = await sendQualifierEmail({
          orgName: target.orgName,
          toEmail: target.contactEmail,
          conversationId: target.conversationId,
          subject: `Your inquiry with ${target.orgName}`,
          body,
          inReplyTo: lastInbound?.ref ?? null,
        });
        if (sent.ok) {
          channel = "email";
          providerRef = sent.id ?? null;
          note = "emailed to the contact";
        } else {
          // Record it anyway so the thread is intact; flag the delivery failure.
          Sentry.captureMessage(`Qualifier email send failed: ${sent.error}`, "warning");
          note = `recorded, but email delivery failed (${sent.error})`;
        }
      }

      await withService(async (tx) => {
        await tx.insert(messages).values({
          orgId: target.orgId,
          conversationId: target.conversationId,
          direction: "outbound",
          author: "assistant",
          channel,
          body,
          providerRef,
        });
        // Stamp first-reply + move a brand-new conversation into 'active'.
        await tx
          .update(conversations)
          .set({
            firstReplySentAt: sql`coalesce(${conversations.firstReplySentAt}, now())`,
            status: sql`case when ${conversations.status} = 'new' then 'active' else ${conversations.status} end`,
            updatedAt: new Date(),
          })
          .where(scoped(target));
      });
      effects.replied = true;
      return `Reply ${note}.`;
    }

    case "record_fit_score": {
      const score = clampScore(input.score);
      if (score === null) return "Error: score must be a number between 0 and 100.";
      const reasons = String(input.reasons ?? "").trim() || null;
      await withService((tx) =>
        tx
          .update(conversations)
          .set({ fitScore: score, scoreReasons: reasons, updatedAt: new Date() })
          .where(scoped(target)),
      );
      effects.score = score;
      return `Recorded fit score ${score}.`;
    }

    case "set_status": {
      const status = String(input.status ?? "");
      if (!SETTABLE_STATUS.includes(status as SettableStatus)) {
        return `Error: status must be one of ${SETTABLE_STATUS.join(", ")}.`;
      }
      await withService((tx) =>
        tx
          .update(conversations)
          .set({ status: status as SettableStatus, updatedAt: new Date() })
          .where(scoped(target)),
      );
      effects.status = status as SettableStatus;
      return `Conversation status set to ${status}.`;
    }

    case "escalate_to_human": {
      const reason = String(input.reason ?? "").trim() || "No reason given.";
      await withService((tx) =>
        tx
          .update(conversations)
          .set({ status: "handed_off", updatedAt: new Date() })
          .where(scoped(target)),
      );
      // Notifying Slack is best-effort — a webhook failure must not fail the turn.
      await notifySlack(
        target.orgId,
        `:rotating_light: Qualifier escalated a lead (${target.contactName}): ${reason}`,
      ).catch(() => undefined);
      effects.status = "handed_off";
      effects.escalated = true;
      return "Escalated to a human and notified the team.";
    }

    default:
      return `Error: unknown tool "${name}".`;
  }
}
