import "server-only";
import { and, eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { contacts, conversations, meetings, messages, withService, type OrgProfile } from "@alevo/db";
import { getBookingAdapter, bookingConfigFromProfile } from "@/lib/booking";
import { retrieveKbContext } from "@/lib/kb/retrieve";
import { notifySlack } from "@/lib/notifications/slack";

export type VoiceToolContext = {
  orgId: string;
  orgName: string;
  profile: OrgProfile;
  callRef: string;
  contactId: string;
  conversationId: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function scoped(ctx: VoiceToolContext) {
  return and(eq(conversations.id, ctx.conversationId), eq(conversations.orgId, ctx.orgId));
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Run one tool call from the voice agent. Returns the text Vapi speaks back to
 * the model. Every write is scoped to the org and the conversation in code.
 */
export async function dispatchVoiceTool(
  name: string,
  args: Record<string, unknown>,
  ctx: VoiceToolContext,
): Promise<string> {
  switch (name) {
    case "lookup_knowledge": {
      const question = str(args.question);
      if (!question) return "Ask the caller what they want to know first.";
      const passages = await retrieveKbContext(ctx.orgId, question, 3).catch(() => []);
      return passages.length ? passages.join("\n\n") : "Nothing in the knowledge base answers that. Say you'll have someone follow up.";
    }

    case "escalate_to_human": {
      const reason = str(args.reason) || "Caller asked for a person";
      await withService((tx) =>
        tx
          .update(conversations)
          .set({ status: "handed_off", updatedAt: new Date() })
          .where(and(scoped(ctx), sql`${conversations.status} <> 'booked'`)),
      );
      await notifySlack(ctx.orgId, `Call escalated: ${reason}`).catch((e) => Sentry.captureException(e));
      return "Someone has been alerted and will join or call back shortly.";
    }

    case "take_message": {
      const name = str(args.name);
      const reason = str(args.reason) || "No reason given";
      const callback = str(args.callback_number);
      const body = [
        "Message taken on a call",
        name && `Name: ${name}`,
        callback && `Callback: ${callback}`,
        `Reason: ${reason}`,
      ]
        .filter(Boolean)
        .join("\n");
      await withService((tx) =>
        tx.insert(messages).values({
          orgId: ctx.orgId,
          conversationId: ctx.conversationId,
          direction: "inbound",
          author: "contact",
          channel: "voice",
          body,
          providerRef: `call:${ctx.callRef}`,
        }),
      );
      await notifySlack(ctx.orgId, body).catch((e) => Sentry.captureException(e));
      return "Message recorded. Let the caller know someone will follow up.";
    }

    case "check_availability": {
      const adapter = await getBookingAdapter(ctx.orgId, bookingConfigFromProfile(ctx.profile));
      if (!adapter) return "Booking isn't connected. Take a message instead.";
      const tz = ctx.profile.timezone ?? "UTC";
      const now = new Date();
      let slots;
      try {
        slots = await adapter.availableSlots(now.toISOString(), new Date(now.getTime() + 7 * DAY_MS).toISOString(), tz);
      } catch (err) {
        Sentry.captureException(err);
        return "Couldn't check the calendar right now. Take a message instead.";
      }
      if (slots.length === 0) return "No open times in the next 7 days. Take a message instead.";
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const lines = slots.slice(0, 6).map((s) => `- ${fmt.format(new Date(s.startIso))} (start: ${s.startIso})`);
      return `Open times. Offer two or three by their day and time, then call book_meeting with the chosen start:\n${lines.join("\n")}`;
    }

    case "book_meeting": {
      const startIso = str(args.start);
      const email = str(args.email);
      if (!email) return "Ask the caller for their email address first.";
      if (!startIso || Number.isNaN(Date.parse(startIso))) {
        return "Error: use the start value from check_availability.";
      }
      const adapter = await getBookingAdapter(ctx.orgId, bookingConfigFromProfile(ctx.profile));
      if (!adapter) return "Booking isn't connected. Take a message instead.";

      const attendeeName = str(args.name) || "Caller";
      const result = await adapter.book({
        startIso,
        attendeeName,
        attendeeEmail: email,
        attendeeTimeZone: ctx.profile.timezone ?? "UTC",
        conversationId: ctx.conversationId,
        orgId: ctx.orgId,
        orgName: ctx.orgName,
      });
      if (!result.ok) return `Booking failed (${result.error}). Offer another time or take a message.`;

      await withService(async (tx) => {
        await tx
          .update(contacts)
          .set({ email, firstName: attendeeName, updatedAt: new Date() })
          .where(and(eq(contacts.id, ctx.contactId), eq(contacts.orgId, ctx.orgId)));
        await tx
          .insert(meetings)
          .values({
            orgId: ctx.orgId,
            conversationId: ctx.conversationId,
            contactId: ctx.contactId,
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
          .where(scoped(ctx));
      });
      return "Booked. A calendar invite is on its way to the caller by email. Confirm the time out loud and end the call.";
    }

    case "record_fit_score": {
      const raw = typeof args.score === "number" ? args.score : Number(args.score);
      if (!Number.isFinite(raw)) return "Error: score must be a number from 0 to 100.";
      const score = Math.max(0, Math.min(100, Math.round(raw)));
      const reasons = str(args.reasons) || null;
      await withService((tx) =>
        tx
          .update(conversations)
          .set({ fitScore: score, scoreReasons: reasons, updatedAt: new Date() })
          .where(scoped(ctx)),
      );
      return `Recorded fit score ${score}.`;
    }

    case "set_status": {
      const status = str(args.status);
      if (status !== "handed_off" && status !== "disqualified") {
        return "Error: status must be handed_off or disqualified. A booking sets 'booked' by itself.";
      }
      // A booking is final: never overwrite it.
      const updated = await withService((tx) =>
        tx
          .update(conversations)
          .set({ status, updatedAt: new Date() })
          .where(and(scoped(ctx), sql`${conversations.status} <> 'booked'`))
          .returning({ id: conversations.id }),
      );
      if (updated.length === 0) return "The meeting is already booked, so the status stays booked. You're done.";
      if (status === "handed_off") {
        const note = str(args.note) || "A person needs to follow up";
        await notifySlack(ctx.orgId, `Lead handed off after a call: ${note}`).catch((e) => Sentry.captureException(e));
      }
      return status === "handed_off" ? "Lead marked for a person to follow up." : "Lead marked as not a fit.";
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
