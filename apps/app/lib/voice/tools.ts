import "server-only";
import { and, eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { claimIdentity, conversations, meetings, messages, withService, type OrgProfile } from "@alevo/db";
import { requestPsaWriteback } from "@/lib/psa/request";
import { notifyBookingFailed, notifyMeetingBooked, notifyQualifiedLead } from "@/lib/notifications/lead-events";
import type { BookingFailure } from "@/lib/notifications/lead-messages";
import { crossedStrongFit } from "@/lib/notifications/lead-messages";
import { getBookingAdapter, bookingConfigFromProfile } from "@/lib/booking";
import { daySlots, formatSlot, offerSlots } from "@/lib/booking/offer";
import { CONTACT_DETAILS_TOOL, getContactEmail, saveContactDetails } from "@/lib/contact-details";
import { retrieveKbContext } from "@/lib/kb/retrieve";
import { notifyOrg } from "@/lib/notifications/notify";
import { profileTimeZone } from "./schedule";

export type VoiceToolContext = {
  orgId: string;
  orgName: string;
  profile: OrgProfile;
  callRef: string;
  contactId: string;
  conversationId: string;
};


function scoped(ctx: VoiceToolContext) {
  return and(eq(conversations.id, ctx.conversationId), eq(conversations.orgId, ctx.orgId));
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** The calendar failed mid-call: alert the org (Slack + email), hand the caller to a person. */
async function bookingBroke(ctx: VoiceToolContext, failure: BookingFailure): Promise<string> {
  if (await notifyBookingFailed(ctx.orgId, ctx.conversationId, failure)) {
    await requestPsaWriteback(ctx.orgId, ctx.conversationId, "handed_off");
  }
  return "The calendar isn't working right now. The team has been told. Tell the caller a colleague will call them back to set a time, and take a message.";
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
    case CONTACT_DETAILS_TOOL.name: {
      const { saved, contactId } = await saveContactDetails(ctx.orgId, ctx.contactId, {
        name: str(args.name),
        email: str(args.email),
        company: str(args.company),
      });
      ctx.contactId = contactId; // the caller may have just merged into an existing contact
      return saved.length ? `Saved ${saved.join(", ")}.` : "Nothing new to save.";
    }

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
      await notifyOrg(ctx.orgId, `Call escalated: ${reason}`).catch((e) => Sentry.captureException(e));
      await requestPsaWriteback(ctx.orgId, ctx.conversationId, "handed_off");
      return "Someone has been alerted and will join or call back shortly.";
    }

    case "take_message": {
      const name = str(args.name);
      const reason = str(args.reason);
      const callback = str(args.callback_number);
      // Vapi sometimes fires a tool call with empty arguments and the model retries
      // with the real ones a few seconds later. Write nothing for the empty one.
      if (!name && !reason && !callback) {
        return "Error: no details received. Call take_message again with the reason, the caller's name and their callback number.";
      }
      if (name) ctx.contactId = (await saveContactDetails(ctx.orgId, ctx.contactId, { name })).contactId;
      // A callback number is an identity too: it may belong to a contact the org already knows.
      if (callback) ctx.contactId = (await claimIdentity(ctx.orgId, ctx.contactId, { phone: callback })).id;
      const body = [
        "Message taken on a call",
        name && `Name: ${name}`,
        callback && `Callback: ${callback}`,
        `Reason: ${reason || "No reason given"}`,
      ]
        .filter(Boolean)
        .join("\n");
      // One message per call; a fuller retry replaces the earlier one. The ref is
      // distinct from the end-of-call summary's (`call:<id>:summary`).
      await withService((tx) =>
        tx
          .insert(messages)
          .values({
            orgId: ctx.orgId,
            conversationId: ctx.conversationId,
            direction: "inbound",
            author: "contact",
            channel: "voice",
            body,
            providerRef: `call:${ctx.callRef}:message`,
          })
          .onConflictDoUpdate({
            target: [messages.orgId, messages.providerRef],
            targetWhere: sql`${messages.providerRef} is not null`,
            set: { body },
          }),
      );
      await notifyOrg(ctx.orgId, body).catch((e) => Sentry.captureException(e));
      return "Message recorded. Let the caller know someone will follow up.";
    }

    case "check_availability": {
      const tz = profileTimeZone(ctx.profile);
      const day = str(args.day);
      // Anything that fails here — token refresh, free/busy, an unreadable calendar —
      // is a hand-off, never a guess: the agent must not offer times it cannot see.
      try {
        const adapter = await getBookingAdapter(ctx.orgId, bookingConfigFromProfile(ctx.profile));
        if (!adapter) return "Booking isn't connected. Take a message instead.";
        const line = (s: { startIso: string }) => `- ${formatSlot(s.startIso, tz, "spoken")} (start: ${s.startIso})`;
        if (day) {
          const slots = await daySlots(adapter, day, tz);
          if (!slots) return "Error: day must be YYYY-MM-DD.";
          if (slots.length === 0) return `Nothing open on ${day}. Offer another day.`;
          return `Open times on ${day}. Offer the ones closest to what the caller asked for, then call book_meeting with the chosen start:\n${slots.slice(0, 16).map(line).join("\n")}`;
        }
        const offer = await offerSlots(adapter, tz);
        if (offer.window === "none") return "No open times in the next 7 days. Take a message instead.";
        const note = offer.window === "7d" ? "Nothing open in the next three days, so these are the soonest this week. " : "";
        return `${note}Open times. Offer two of them by day and time (the rest if neither suits). If the caller asks for a different day or time, call check_availability again with that day. Then call book_meeting with the chosen start:\n${offer.slots.map(line).join("\n")}`;
      } catch (err) {
        Sentry.captureException(err);
        return bookingBroke(ctx, { step: "availability", detail: err instanceof Error ? err.message : null });
      }
    }

    case "book_meeting": {
      const startIso = str(args.start);
      // The model often saves the email in the same batch and forgets to pass it here;
      // asking again made it repeat its waiting line. Use what is on file.
      const email = str(args.email) || ((await getContactEmail(ctx.orgId, ctx.contactId)) ?? "");
      if (!email) return "Ask the caller for their email address first.";
      if (!startIso || Number.isNaN(Date.parse(startIso))) {
        return "Error: use the start value from check_availability.";
      }
      // Resolving the adapter (token refresh) can throw like the booking itself; both
      // are a hand-off with the calendar's reason, never a bare "something went wrong".
      let adapter: Awaited<ReturnType<typeof getBookingAdapter>>;
      let result: Awaited<ReturnType<NonNullable<typeof adapter>["book"]>>;
      try {
        adapter = await getBookingAdapter(ctx.orgId, bookingConfigFromProfile(ctx.profile));
        if (!adapter) return "Booking isn't connected. Take a message instead.";
        result = await adapter.book({
          startIso,
          attendeeName: str(args.name) || "Caller",
          attendeeEmail: email,
          attendeeTimeZone: profileTimeZone(ctx.profile),
          conversationId: ctx.conversationId,
          orgId: ctx.orgId,
          orgName: ctx.orgName,
        });
      } catch (err) {
        Sentry.captureException(err);
        return bookingBroke(ctx, { step: "booking", detail: err instanceof Error ? err.message : null });
      }
      if (!result.ok) {
        if (result.conflict) return `Booking failed (${result.error}). Offer another time.`;
        return bookingBroke(ctx, { step: "booking", detail: result.error });
      }

      // The calendar has the event: from here the caller hears "Booked" whatever else
      // fails (on 2026-11-02 a contact write between the two left events in Google and
      // nothing in Meetings). Record first; every later step is best-effort.
      const recorded = await withService(async (tx) => {
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
      }).then(
        () => true,
        (err: unknown) => {
          Sentry.captureException(err);
          return false;
        },
      );
      if (!recorded) {
        await notifyOrg(ctx.orgId, `A call booked ${result.startIso} on the calendar (${adapter.provider} ${result.uid}) but Alevo could not record it. Check Meetings.`).catch(() => {});
      }
      // The real name only (never the "Caller" placeholder) plus the email they gave.
      // A merge moves the meeting row along with the contact.
      try {
        ctx.contactId = (await saveContactDetails(ctx.orgId, ctx.contactId, { name: str(args.name), email })).contactId;
      } catch (err) {
        Sentry.captureException(err);
      }
      await notifyMeetingBooked(ctx.orgId, ctx.conversationId).catch((e: unknown) => Sentry.captureException(e));
      await requestPsaWriteback(ctx.orgId, ctx.conversationId, "booked").catch((e: unknown) => Sentry.captureException(e));
      return "Booked. A calendar invite is on its way to the caller by email. Confirm the time out loud and end the call.";
    }

    case "record_fit_score": {
      const raw = typeof args.score === "number" ? args.score : Number(args.score);
      if (!Number.isFinite(raw)) return "Error: score must be a number from 0 to 100.";
      const score = Math.max(0, Math.min(100, Math.round(raw)));
      const reasons = str(args.reasons) || null;
      const previous = await withService(async (tx) => {
        const [row] = await tx.select({ fitScore: conversations.fitScore }).from(conversations).where(scoped(ctx)).limit(1);
        await tx.update(conversations).set({ fitScore: score, scoreReasons: reasons, updatedAt: new Date() }).where(scoped(ctx));
        return row?.fitScore ?? null;
      });
      if (crossedStrongFit(previous, score)) await notifyQualifiedLead(ctx.orgId, ctx.conversationId);
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
        await notifyOrg(ctx.orgId, `Lead handed off after a call: ${note}`).catch((e) => Sentry.captureException(e));
        await requestPsaWriteback(ctx.orgId, ctx.conversationId, "handed_off");
      }
      return status === "handed_off" ? "Lead marked for a person to follow up." : "Lead marked as not a fit.";
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
