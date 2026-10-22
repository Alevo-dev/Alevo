import "server-only";
import { getOrgSecret } from "@alevo/db";
import { refreshAccessToken, refreshTokenKey } from "./oauth";
import { generateSlots, isBusy, type BusyInterval } from "./slots";
import type { CalendarConfig } from "./google";
import {
  inviteText,
  type BookingAdapter,
  BookParams,
  BookResult,
  CancelResult,
  RescheduleResult,
} from "./types";

/**
 * Microsoft 365 (Graph) booking adapter (raw HTTP). Books on the signed-in
 * user's default calendar with an auto-generated Teams link. `getSchedule`
 * drives free/busy (falling back to `calendarView` on personal accounts, which
 * also can't create Teams links → plain event). `calendarId` carries the
 * authorized mailbox address (used for getSchedule); events go on `/me/events`.
 */
const GRAPH = "https://graph.microsoft.com/v1.0";

/** Graph wants a tz-less wall-clock string; we pair it with timeZone "UTC". */
const toGraph = (iso: string) => new Date(iso).toISOString().slice(0, 19);
/** Graph returns tz-less UTC (we ask for UTC via Prefer); make it parseable. */
const fromGraph = (dt: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(dt) ? dt : `${dt}Z`);

/** Free/busy from the user's own calendar view (works for every account type). */
async function calendarViewBusy(token: string, fromIso: string, toIso: string): Promise<BusyInterval[]> {
  const qs = new URLSearchParams({
    startDateTime: new Date(fromIso).toISOString(),
    endDateTime: new Date(toIso).toISOString(),
    $select: "start,end,showAs",
    $top: "250",
  });
  const res = await fetch(`${GRAPH}/me/calendarView?${qs}`, {
    headers: { authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) throw new Error(`Graph calendarView failed (${res.status})`);
  const json = (await res.json()) as {
    value?: { showAs?: string; start: { dateTime: string }; end: { dateTime: string } }[];
  };
  return (json.value ?? [])
    .filter((e) => e.showAs !== "free")
    .map((e) => ({ start: fromGraph(e.start.dateTime), end: fromGraph(e.end.dateTime) }));
}

async function getScheduleBusy(
  token: string,
  mailbox: string,
  fromIso: string,
  toIso: string,
): Promise<BusyInterval[]> {
  const res = await fetch(`${GRAPH}/me/calendar/getSchedule`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
    },
    body: JSON.stringify({
      schedules: [mailbox],
      startTime: { dateTime: toGraph(fromIso), timeZone: "UTC" },
      endTime: { dateTime: toGraph(toIso), timeZone: "UTC" },
      availabilityViewInterval: 30,
    }),
  });
  // getSchedule is a work/school (Exchange Online) feature; personal Microsoft
  // accounts reject it. Fall back to reading the calendar view directly.
  if (!res.ok) return calendarViewBusy(token, fromIso, toIso);
  const json = (await res.json()) as {
    value?: {
      scheduleItems?: { status?: string; start: { dateTime: string }; end: { dateTime: string } }[];
    }[];
  };
  const items = json.value?.[0]?.scheduleItems ?? [];
  // Anything not explicitly free blocks the slot (busy / tentative / oof).
  return items
    .filter((i) => i.status !== "free")
    .map((i) => ({ start: fromGraph(i.start.dateTime), end: fromGraph(i.end.dateTime) }));
}

export async function makeM365Adapter(
  orgId: string,
  cfg: CalendarConfig,
): Promise<BookingAdapter | null> {
  const refreshToken = await getOrgSecret(orgId, refreshTokenKey("m365"));
  if (!refreshToken || !cfg.calendarId) return null;
  const token = await refreshAccessToken("m365", refreshToken);
  const mailbox = cfg.calendarId;

  return {
    provider: "m365",

    async availableSlots(fromIso, toIso, timeZone) {
      const busy = await getScheduleBusy(token, mailbox, fromIso, toIso);
      return generateSlots({
        fromIso,
        toIso,
        timeZone: timeZone || cfg.timeZone,
        lengthMin: cfg.lengthMin,
        hoursStart: cfg.hoursStart,
        hoursEnd: cfg.hoursEnd,
        busy,
      });
    },

    async book(params: BookParams): Promise<BookResult> {
      try {
        const endIso = new Date(new Date(params.startIso).getTime() + cfg.lengthMin * 60_000)
          .toISOString();
        const busy = await getScheduleBusy(token, mailbox, params.startIso, endIso);
        if (isBusy(params.startIso, cfg.lengthMin, busy)) {
          return { ok: false, error: "that time was just taken" };
        }
        const event = {
          subject: inviteText(params).title,
          body: { contentType: "text", content: inviteText(params).body },
          start: { dateTime: toGraph(params.startIso), timeZone: "UTC" },
          end: { dateTime: toGraph(endIso), timeZone: "UTC" },
          attendees: [
            {
              emailAddress: { address: params.attendeeEmail, name: params.attendeeName },
              type: "required",
            },
          ],
          transactionId: `alevo-${params.conversationId}-${Date.parse(params.startIso)}`,
        };
        const create = (body: Record<string, unknown>) =>
          fetch(`${GRAPH}/me/events`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              Prefer: 'outlook.timezone="UTC"',
            },
            body: JSON.stringify(body),
          });
        type EventJson = {
          id?: string;
          start?: { dateTime?: string };
          end?: { dateTime?: string };
          onlineMeeting?: { joinUrl?: string } | null;
          error?: { message?: string };
        };
        // Ask for a Teams link first. Personal Microsoft accounts and tenants
        // without Teams reject `teamsForBusiness`; fall back to a plain event so
        // the booking still lands (the invite itself is the confirmation).
        let res = await create({ ...event, isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" });
        let json = (await res.json()) as EventJson;
        if (!res.ok && /online ?meeting|teams/i.test(json.error?.message ?? "")) {
          res = await create(event);
          json = (await res.json()) as EventJson;
        }
        if (!res.ok || !json.id) {
          return { ok: false, error: json.error?.message ?? `Graph booking failed (${res.status})` };
        }
        return {
          ok: true,
          uid: json.id,
          startIso: json.start?.dateTime ? fromGraph(json.start.dateTime).toISOString() : params.startIso,
          endIso: json.end?.dateTime ? fromGraph(json.end.dateTime).toISOString() : endIso,
          joinUrl: json.onlineMeeting?.joinUrl ?? null,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "booking-failed" };
      }
    },

    async cancel(uid: string): Promise<CancelResult> {
      try {
        const res = await fetch(`${GRAPH}/me/events/${encodeURIComponent(uid)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok && res.status !== 404) {
          return { ok: false, error: `Graph cancel failed (${res.status})` };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "cancel-failed" };
      }
    },

    async reschedule(uid: string, newStartIso: string): Promise<RescheduleResult> {
      try {
        const endIso = new Date(new Date(newStartIso).getTime() + cfg.lengthMin * 60_000)
          .toISOString();
        const busy = await getScheduleBusy(token, mailbox, newStartIso, endIso);
        if (isBusy(newStartIso, cfg.lengthMin, busy)) {
          return { ok: false, error: "that time is no longer open" };
        }
        const res = await fetch(`${GRAPH}/me/events/${encodeURIComponent(uid)}`, {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            Prefer: 'outlook.timezone="UTC"',
          },
          body: JSON.stringify({
            start: { dateTime: toGraph(newStartIso), timeZone: "UTC" },
            end: { dateTime: toGraph(endIso), timeZone: "UTC" },
          }),
        });
        const json = (await res.json()) as {
          id?: string;
          start?: { dateTime?: string };
          end?: { dateTime?: string };
          onlineMeeting?: { joinUrl?: string } | null;
          error?: { message?: string };
        };
        if (!res.ok || !json.id) {
          return { ok: false, error: json.error?.message ?? `Graph reschedule failed (${res.status})` };
        }
        return {
          ok: true,
          uid: json.id,
          startIso: json.start?.dateTime ? fromGraph(json.start.dateTime).toISOString() : newStartIso,
          endIso: json.end?.dateTime ? fromGraph(json.end.dateTime).toISOString() : endIso,
          joinUrl: json.onlineMeeting?.joinUrl ?? null,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "reschedule-failed" };
      }
    },
  };
}
