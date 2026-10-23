import type { BookingProvider } from "@alevo/db";

/**
 * Which booking tools are *connected* — set up under Integrations well enough
 * for the agent to book through them. Booking (Agent tab) only offers these.
 * Pure: takes the profile row + the set of stored secret keys (never values).
 */

/** The tools an org can pick. `manual` exists on the enum but isn't a choice. */
export type BookingTool = "calcom" | "google" | "m365" | "calendly";
export const BOOKING_TOOLS: readonly BookingTool[] = ["calcom", "google", "m365", "calendly"];
export const BOOKING_TOOL_LABEL: Record<BookingTool, string> = {
  calcom: "Cal.com",
  google: "Google Calendar",
  m365: "Microsoft 365",
  calendly: "Calendly",
};

export function isBookingTool(value: unknown): value is BookingTool {
  return (BOOKING_TOOLS as readonly unknown[]).includes(value);
}

export type BookingSnapshot = {
  tool: BookingProvider | null;
  calcomEventTypeId: number | null;
  calendarProvider: BookingProvider | null;
  calendarId: string | null;
  calendarAccountEmail: string | null;
  calendlyUrl: string | null;
};

type ProfileLike = Partial<{
  bookingTool: BookingProvider | null;
  calcomEventTypeId: number | null;
  calendarProvider: BookingProvider | null;
  calendarId: string | null;
  calendarAccountEmail: string | null;
  calendlyUrl: string | null;
}>;

export function bookingSnapshot(row: ProfileLike | undefined): BookingSnapshot {
  return {
    tool: row?.bookingTool ?? null,
    calcomEventTypeId: row?.calcomEventTypeId ?? null,
    calendarProvider: row?.calendarProvider ?? null,
    calendarId: row?.calendarId ?? null,
    calendarAccountEmail: row?.calendarAccountEmail ?? null,
    calendlyUrl: row?.calendlyUrl ?? null,
  };
}

type Has = (secretKey: string) => boolean;

/** What's still missing before the tool can book; null when it is connected. */
export function bookingToolMissing(tool: BookingTool, snap: BookingSnapshot, has: Has): string | null {
  switch (tool) {
    case "calcom": {
      const key = has("calcom_api_key");
      const type = snap.calcomEventTypeId != null;
      if (key && type) return null;
      if (!key && !type) return "API key and event type ID";
      return key ? "event type ID" : "API key";
    }
    case "google":
    case "m365":
      return snap.calendarProvider === tool && Boolean(snap.calendarId) && has(`${tool}_calendar_refresh_token`)
        ? null
        : "a connected calendar";
    case "calendly":
      return snap.calendlyUrl ? null : "scheduling link";
  }
}

export type ConnectedTool = { tool: BookingTool; label: string; detail: string | null };

/** The connected tools, with a one-line detail for the Booking section. */
export function connectedBookingTools(snap: BookingSnapshot, has: Has): ConnectedTool[] {
  const detail: Record<BookingTool, string | null> = {
    calcom: snap.calcomEventTypeId != null ? `event type ${snap.calcomEventTypeId}` : null,
    google: snap.calendarAccountEmail,
    m365: snap.calendarAccountEmail,
    calendly: snap.calendlyUrl,
  };
  return BOOKING_TOOLS.filter((tool) => bookingToolMissing(tool, snap, has) === null).map((tool) => ({
    tool,
    label: BOOKING_TOOL_LABEL[tool],
    detail: detail[tool],
  }));
}
