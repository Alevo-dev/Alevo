import "server-only";
import { getOrgSecret } from "@alevo/db";
import { refreshAccessToken, refreshTokenKey } from "./oauth";
import { generateSlots, isBusy, type BusyInterval } from "./slots";
import type {
  BookingAdapter,
  BookParams,
  BookResult,
  CancelResult,
  RescheduleResult,
} from "./types";

/**
 * Google Calendar booking adapter (raw HTTP, no SDK). Per-org auth via the
 * stored refresh token (exchanged for a short-lived access token when the
 * adapter is built). Free/busy drives slot generation; events are created with
 * an auto-generated Google Meet link. Basic, single-calendar — no round-robin.
 */
const BASE = "https://www.googleapis.com/calendar/v3";

export type CalendarConfig = {
  /** Google: the calendar id ("primary" or a calendar's address). */
  calendarId: string;
  lengthMin: number;
  hoursStart: number;
  hoursEnd: number;
  /** Working-hours timezone (org default; the contact's tz overrides per call). */
  timeZone: string;
};

async function freeBusy(
  token: string,
  calendarId: string,
  fromIso: string,
  toIso: string,
): Promise<BusyInterval[]> {
  const res = await fetch(`${BASE}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, items: [{ id: calendarId }] }),
  });
  if (!res.ok) throw new Error(`Google free/busy failed (${res.status})`);
  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  const busy = json.calendars?.[calendarId]?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function makeGoogleAdapter(
  orgId: string,
  cfg: CalendarConfig,
): Promise<BookingAdapter | null> {
  const refreshToken = await getOrgSecret(orgId, refreshTokenKey("google"));
  if (!refreshToken || !cfg.calendarId) return null;
  const token = await refreshAccessToken("google", refreshToken);
  const cal = encodeURIComponent(cfg.calendarId);

  return {
    provider: "google",

    async availableSlots(fromIso, toIso, timeZone) {
      const busy = await freeBusy(token, cfg.calendarId, fromIso, toIso);
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
        // Double-booking guard: re-check the exact slot right before writing.
        const busy = await freeBusy(token, cfg.calendarId, params.startIso, endIso);
        if (isBusy(params.startIso, cfg.lengthMin, busy)) {
          return { ok: false, error: "that time was just taken" };
        }
        const res = await fetch(`${BASE}/calendars/${cal}/events?conferenceDataVersion=1`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            summary: `Meeting with ${params.attendeeName}`,
            start: { dateTime: params.startIso, timeZone: "UTC" },
            end: { dateTime: endIso, timeZone: "UTC" },
            attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
            conferenceData: {
              createRequest: {
                conferenceSolutionKey: { type: "hangoutsMeet" },
                requestId: `alevo-${params.conversationId}-${Date.parse(params.startIso)}`,
              },
            },
            extendedProperties: {
              private: { alevoOrgId: params.orgId, alevoConversationId: params.conversationId },
            },
          }),
        });
        const json = (await res.json()) as {
          id?: string;
          start?: { dateTime?: string };
          end?: { dateTime?: string };
          hangoutLink?: string;
          error?: { message?: string };
        };
        if (!res.ok || !json.id) {
          return { ok: false, error: json.error?.message ?? `Google booking failed (${res.status})` };
        }
        return {
          ok: true,
          uid: json.id,
          startIso: json.start?.dateTime ?? params.startIso,
          endIso: json.end?.dateTime ?? endIso,
          joinUrl: json.hangoutLink ?? null,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "booking-failed" };
      }
    },

    async cancel(uid: string): Promise<CancelResult> {
      try {
        const res = await fetch(`${BASE}/calendars/${cal}/events/${encodeURIComponent(uid)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        });
        // 410 Gone = already cancelled; treat as success (idempotent).
        if (!res.ok && res.status !== 410) {
          return { ok: false, error: `Google cancel failed (${res.status})` };
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
        const busy = await freeBusy(token, cfg.calendarId, newStartIso, endIso);
        if (isBusy(newStartIso, cfg.lengthMin, busy)) {
          return { ok: false, error: "that time is no longer open" };
        }
        const res = await fetch(`${BASE}/calendars/${cal}/events/${encodeURIComponent(uid)}`, {
          method: "PATCH",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            start: { dateTime: newStartIso, timeZone: "UTC" },
            end: { dateTime: endIso, timeZone: "UTC" },
          }),
        });
        const json = (await res.json()) as {
          id?: string;
          start?: { dateTime?: string };
          end?: { dateTime?: string };
          hangoutLink?: string;
          error?: { message?: string };
        };
        if (!res.ok || !json.id) {
          return { ok: false, error: json.error?.message ?? `Google reschedule failed (${res.status})` };
        }
        return {
          ok: true,
          uid: json.id,
          startIso: json.start?.dateTime ?? newStartIso,
          endIso: json.end?.dateTime ?? endIso,
          joinUrl: json.hangoutLink ?? null,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "reschedule-failed" };
      }
    },
  };
}
