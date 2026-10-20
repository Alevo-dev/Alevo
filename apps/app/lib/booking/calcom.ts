import "server-only";
import { getOrgSecret } from "@alevo/db";
import type {
  BookingAdapter,
  BookParams,
  BookResult,
  CancelResult,
  RescheduleResult,
  Slot,
} from "./types";

/**
 * Cal.com v2 booking adapter. Raw HTTP (no SDK). Per-org auth via the stored
 * `calcom_api_key`; the event type comes from org_profiles. Slots and bookings
 * use different pinned `cal-api-version` values (per Cal.com's docs).
 */
const BASE = "https://api.cal.com/v2";
const SLOTS_VERSION = "2024-09-04";
const BOOKINGS_VERSION = "2026-02-25";

/** Returns a Cal.com adapter, or null when the org hasn't connected a key. */
export async function makeCalcomAdapter(
  orgId: string,
  eventTypeId: number,
): Promise<BookingAdapter | null> {
  const apiKey = await getOrgSecret(orgId, "calcom_api_key");
  if (!apiKey) return null;

  const auth = { authorization: `Bearer ${apiKey}` };

  return {
    provider: "calcom",

    async availableSlots(fromIso, toIso, timeZone) {
      const qs = new URLSearchParams({
        eventTypeId: String(eventTypeId),
        start: fromIso,
        end: toIso,
        timeZone,
      });
      const res = await fetch(`${BASE}/slots?${qs}`, {
        headers: { ...auth, "cal-api-version": SLOTS_VERSION },
      });
      if (!res.ok) throw new Error(`Cal.com slots failed (${res.status})`);
      const json = (await res.json()) as {
        data?: Record<string, { start: string }[]>;
      };
      // data is keyed by date → array of { start }; flatten and sort.
      const slots: Slot[] = Object.values(json.data ?? {})
        .flat()
        .map((s) => ({ startIso: s.start }))
        .sort((a, b) => a.startIso.localeCompare(b.startIso));
      return slots;
    },

    async book(params: BookParams): Promise<BookResult> {
      try {
        const res = await fetch(`${BASE}/bookings`, {
          method: "POST",
          headers: { ...auth, "cal-api-version": BOOKINGS_VERSION, "content-type": "application/json" },
          body: JSON.stringify({
            start: params.startIso,
            eventTypeId,
            attendee: {
              name: params.attendeeName,
              email: params.attendeeEmail,
              timeZone: params.attendeeTimeZone,
              language: "en",
            },
            metadata: { alevoConversationId: params.conversationId, alevoOrgId: params.orgId },
          }),
        });
        const json = (await res.json()) as {
          data?: { uid: string; start: string; end?: string; location?: string };
          error?: { message?: string };
        };
        if (!res.ok || !json.data?.uid) {
          return { ok: false, error: json.error?.message ?? `Cal.com booking failed (${res.status})` };
        }
        return {
          ok: true,
          uid: json.data.uid,
          startIso: json.data.start,
          endIso: json.data.end ?? null,
          joinUrl: json.data.location ?? null,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "booking-failed" };
      }
    },

    async cancel(uid: string, reason?: string): Promise<CancelResult> {
      try {
        const res = await fetch(`${BASE}/bookings/${encodeURIComponent(uid)}/cancel`, {
          method: "POST",
          headers: { ...auth, "cal-api-version": BOOKINGS_VERSION, "content-type": "application/json" },
          body: JSON.stringify(reason ? { cancellationReason: reason } : {}),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          return { ok: false, error: json.error?.message ?? `Cal.com cancel failed (${res.status})` };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "cancel-failed" };
      }
    },

    async reschedule(uid: string, newStartIso: string, reason?: string): Promise<RescheduleResult> {
      try {
        const res = await fetch(`${BASE}/bookings/${encodeURIComponent(uid)}/reschedule`, {
          method: "POST",
          headers: { ...auth, "cal-api-version": BOOKINGS_VERSION, "content-type": "application/json" },
          body: JSON.stringify({ start: newStartIso, ...(reason ? { reschedulingReason: reason } : {}) }),
        });
        const json = (await res.json()) as {
          data?: { uid: string; start: string; end?: string; location?: string };
          error?: { message?: string };
        };
        if (!res.ok || !json.data?.uid) {
          return { ok: false, error: json.error?.message ?? `Cal.com reschedule failed (${res.status})` };
        }
        return {
          ok: true,
          uid: json.data.uid,
          startIso: json.data.start,
          endIso: json.data.end ?? null,
          joinUrl: json.data.location ?? null,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "reschedule-failed" };
      }
    },
  };
}
