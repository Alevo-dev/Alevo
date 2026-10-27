import type Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { conversations, isSuppressed, meetings, messages, withService, type Channel } from "@alevo/db";
import { notifySlack } from "@/lib/notifications/slack";
import { isEmailConfigured, sendQualifierEmail } from "@/lib/email/resend";
import { isSmsConfigured, sendSms } from "@/lib/sms/twilio";
import { getBookingAdapter, type BookingConfig } from "@/lib/booking";
import { formatSlot, offerSlots } from "@/lib/booking/offer";
import { CONTACT_DETAILS_TOOL, saveContactDetails } from "@/lib/contact-details";

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
    name: CONTACT_DETAILS_TOOL.name,
    description: CONTACT_DETAILS_TOOL.description,
    input_schema: { type: "object", properties: CONTACT_DETAILS_TOOL.properties },
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
  booked: boolean;
};

export type DispatchTarget = {
  orgId: string;
  conversationId: string;
  contactId: string;
  channel: Channel;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTimezone: string | null;
  smsFromNumber: string | null;
  bookingConfig: BookingConfig;
  calendlyUrl: string | null;
  orgName: string;
};

/** Booking tools — added to the Qualifier's toolset only when booking is connected. */
export const BOOKING_TOOLS: Anthropic.Tool[] = [
  {
    name: "check_availability",
    description:
      "List open meeting times to offer the contact: a few spread over the next 24–72 hours (a week if the calendar is full). Call it as soon as the lead is qualified, then propose two or three of them.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "book_meeting",
    description:
      "Book a meeting at a specific slot once the contact has agreed to a time. Requires the contact's email — ask for it first if missing.",
    input_schema: {
      type: "object",
      properties: {
        start: {
          type: "string",
          description: "The chosen slot's start as an ISO-8601 timestamp (from check_availability).",
        },
      },
      required: ["start"],
    },
  },
];

/** Calendly link-mode tool — added when the org uses Calendly instead of Cal.com. */
export const LINK_BOOKING_TOOLS: Anthropic.Tool[] = [
  {
    name: "send_booking_link",
    description:
      "Send the org's scheduling link so the contact books a time themselves. Use when a qualified lead wants to talk, book, or see a demo.",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Optional short, friendly intro to send just before the link.",
        },
      },
    },
  },
];

const clampScore = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;

/** Scope every write to this org + conversation (service path has no RLS). */
/** Guard for status writes: the agent never overwrites a booking. */
function notBooked() {
  return sql`${conversations.status} <> 'booked'`;
}

function scoped(target: DispatchTarget) {
  return and(
    eq(conversations.id, target.conversationId),
    eq(conversations.orgId, target.orgId),
  );
}

/**
 * Tell the org a lead needs a human (handoff or escalation). Best-effort: with
 * no Slack webhook configured `notifySlack` no-ops, and any failure is swallowed
 * so the agent turn never fails. Carries the fit score + a link to the thread.
 */
async function notifyHandoff(
  target: DispatchTarget,
  opts: { urgent?: boolean; reason?: string } = {},
): Promise<void> {
  const [row] = await withService((tx) =>
    tx
      .select({ fitScore: conversations.fitScore, scoreReasons: conversations.scoreReasons })
      .from(conversations)
      .where(scoped(target))
      .limit(1),
  );
  const who = target.contactEmail
    ? `${target.contactName} (${target.contactEmail})`
    : target.contactName;
  const score = row?.fitScore != null ? `${row.fitScore}/100` : "not scored";
  const detail = opts.reason
    ? `\nReason: ${opts.reason}`
    : row?.scoreReasons
      ? `\nWhy: ${row.scoreReasons}`
      : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const link = appUrl ? `\n${appUrl}/conversations/${target.conversationId}` : "";
  const header = opts.urgent
    ? ":rotating_light: Lead escalated — needs a human now"
    : ":inbox_tray: Lead handed off — ready for a human";
  await notifySlack(
    target.orgId,
    `${header}\n${who}\nFit score: ${score}${detail}${link}`,
  ).catch(() => undefined);
}

/**
 * Deliver one outbound message on the conversation's channel (SMS → email →
 * in-app fallback), record it, and move a brand-new conversation to 'active'.
 * Returns a short human note describing what happened. Shared by reply_to_contact
 * and book_meeting's confirmation so delivery never depends on the model
 * remembering to call the reply tool afterwards.
 */
async function deliverMessage(target: DispatchTarget, body: string): Promise<string> {
  let channel: Channel = target.channel;
  let providerRef: string | null = null;
  let note = "recorded in-app (no channel configured)";

  if (target.channel === "sms" && target.contactPhone && target.smsFromNumber && isSmsConfigured()) {
    const sent = await sendSms({
      fromNumber: target.smsFromNumber,
      toPhone: target.contactPhone,
      body,
    });
    if (sent.ok) {
      channel = "sms";
      providerRef = sent.sid ?? null;
      note = "texted to the contact";
    } else if (sent.optedOut) {
      note = "not sent — contact opted out of SMS (STOP)";
    } else {
      Sentry.captureMessage(`Qualifier SMS send failed: ${sent.error}`, "warning");
      note = `recorded, but SMS delivery failed (${sent.error})`;
    }
  } else if (
    target.contactEmail &&
    isEmailConfigured() &&
    (await isSuppressed(target.orgId, target.contactEmail))
  ) {
    note = "recorded in-app (contact is unsubscribed — not emailed)";
  } else if (target.contactEmail && isEmailConfigured()) {
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
      orgId: target.orgId,
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
    await tx
      .update(conversations)
      .set({
        firstReplySentAt: sql`coalesce(${conversations.firstReplySentAt}, now())`,
        status: sql`case when ${conversations.status} = 'new' then 'active' else ${conversations.status} end`,
        updatedAt: new Date(),
      })
      .where(scoped(target));
  });
  return note;
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
      const note = await deliverMessage(target, body);
      effects.replied = true;
      return `Reply ${note}.`;
    }

    case CONTACT_DETAILS_TOOL.name: {
      const field = (k: string) => String(input[k] ?? "").trim();
      const saved = await saveContactDetails(target.orgId, target.contactId, {
        name: field("name"),
        email: field("email"),
        company: field("company"),
      });
      return saved.length ? `Saved ${saved.join(", ")}.` : "Nothing new to save.";
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
      // A booking is final: "booked" means the meeting is on the calendar, while
      // "handed_off" means a person still has to reach out to get one booked.
      if (effects.booked) return "The meeting is already booked — status unchanged. You're done.";
      await withService((tx) =>
        tx
          .update(conversations)
          .set({ status: status as SettableStatus, updatedAt: new Date() })
          .where(and(scoped(target), notBooked())),
      );
      effects.status = status as SettableStatus;
      // Alert the org the moment a lead is handed to a human (best-effort Slack).
      if (status === "handed_off") await notifyHandoff(target);
      return `Conversation status set to ${status}.`;
    }

    case "escalate_to_human": {
      const reason = String(input.reason ?? "").trim() || undefined;
      // Still alert the team, but never downgrade a booked conversation.
      await withService((tx) =>
        tx
          .update(conversations)
          .set({ status: "handed_off", updatedAt: new Date() })
          .where(and(scoped(target), notBooked())),
      );
      await notifyHandoff(target, { urgent: true, reason });
      if (!effects.booked) effects.status = "handed_off";
      effects.escalated = true;
      return "Escalated to a human and notified the team.";
    }

    case "check_availability": {
      const adapter = await getBookingAdapter(target.orgId, target.bookingConfig);
      if (!adapter) return "Booking isn't connected for this org — hand off instead.";
      const tz = target.contactTimezone ?? "UTC";
      let offer;
      try {
        offer = await offerSlots(adapter, tz);
      } catch (err) {
        Sentry.captureException(err);
        return "Couldn't fetch availability right now — try again or hand off.";
      }
      if (offer.window === "none") return "No open slots in the next 7 days — hand off to a human.";
      const lines = offer.slots.map((s) => `- ${formatSlot(s.startIso, tz, "written")} — ${s.startIso}`);
      const note = offer.window === "7d" ? "Nothing open in the next 72 hours, so these are the soonest times this week. " : "";
      return `${note}Open times in the contact's timezone (${tz}). Offer two or three of them, then call book_meeting with the chosen ISO start:\n${lines.join("\n")}`;
    }

    case "book_meeting": {
      if (!target.contactEmail) return "Ask the contact for their email before booking.";
      const adapter = await getBookingAdapter(target.orgId, target.bookingConfig);
      if (!adapter) return "Booking isn't connected for this org — hand off instead.";
      const startIso = String(input.start ?? "").trim();
      if (!startIso || Number.isNaN(Date.parse(startIso))) {
        return "Error: provide the slot start as an ISO-8601 timestamp from check_availability.";
      }
      const result = await adapter.book({
        startIso,
        attendeeName: target.contactName,
        attendeeEmail: target.contactEmail,
        attendeeTimeZone: target.contactTimezone ?? "UTC",
        conversationId: target.conversationId,
        orgId: target.orgId,
        orgName: target.orgName,
      });
      if (!result.ok) return `Booking failed (${result.error}). Offer another time or hand off.`;

      // Confirm to the contact ourselves — never rely on the model to follow up.
      const when = new Intl.DateTimeFormat("en-US", {
        timeZone: target.contactTimezone ?? "UTC",
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(result.startIso));
      const note = await deliverMessage(
        target,
        `Great news — you're booked for ${when}. You'll get a calendar invite by email with all the details. Looking forward to speaking!`,
      );

      await withService(async (tx) => {
        await tx
          .insert(meetings)
          .values({
            orgId: target.orgId,
            conversationId: target.conversationId,
            contactId: target.contactId,
            provider: adapter.provider,
            providerRef: result.uid,
            status: "scheduled",
            startAt: new Date(result.startIso),
            endAt: result.endIso ? new Date(result.endIso) : null,
            joinUrl: result.joinUrl,
          })
          .onConflictDoNothing();
        await tx
          .update(conversations)
          .set({ status: "booked", updatedAt: new Date() })
          .where(scoped(target));
      });
      effects.booked = true;
      effects.replied = true;
      return `Booked for ${result.startIso} and confirmed to the contact (${note}). You're done — do not send another message.`;
    }

    case "send_booking_link": {
      if (!target.calendlyUrl) return "No scheduling link configured — hand off instead.";
      let link: string;
      try {
        const u = new URL(target.calendlyUrl);
        u.searchParams.set("utm_source", "alevo");
        // Carries back on the Calendly webhook so we tie the booking to this conversation.
        u.searchParams.set("utm_content", target.conversationId);
        link = u.toString();
      } catch {
        return "The configured scheduling link is invalid.";
      }
      const intro = String(input.message ?? "").trim() || "You can grab a time that works for you here:";
      const note = await deliverMessage(target, `${intro}\n${link}`);
      effects.replied = true;
      return `Scheduling link sent (${note}). The contact books themselves — you're done, do not send another message.`;
    }

    default:
      return `Error: unknown tool "${name}".`;
  }
}
