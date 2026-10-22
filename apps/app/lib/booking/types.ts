import type { BookingProvider } from "@alevo/db";

/** An open slot, start time as an ISO-8601 UTC string. */
export type Slot = { startIso: string };

export type BookParams = {
  startIso: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeeTimeZone: string;
  conversationId: string;
  orgId: string;
  /** The tenant's company name — the invite's title/body are branded with it. */
  orgName: string;
};

/** Invite title + body. The organizer (From) is always the connected calendar's owner. */
export function inviteText(p: Pick<BookParams, "attendeeName" | "orgName">) {
  return {
    title: `${p.orgName}: intro call with ${p.attendeeName}`,
    body: `Intro call between ${p.attendeeName} and ${p.orgName}, booked by ${p.orgName}'s assistant. Need a different time? Just reply to the message thread.`,
  };
}

export type BookResult =
  | { ok: true; uid: string; startIso: string; endIso: string | null; joinUrl: string | null }
  | { ok: false; error: string };

export type CancelResult = { ok: true } | { ok: false; error: string };

export type RescheduleResult =
  | { ok: true; uid: string; startIso: string; endIso: string | null; joinUrl: string | null }
  | { ok: false; error: string };

/**
 * Provider-agnostic booking seam (rule 6). Cal.com implements it now; Google /
 * M365 drop in behind the same interface later. The Qualifier calls
 * `availableSlots` + `book`; reps cancel/reschedule from the Meetings tab.
 */
export interface BookingAdapter {
  provider: BookingProvider;
  availableSlots(fromIso: string, toIso: string, timeZone: string): Promise<Slot[]>;
  book(params: BookParams): Promise<BookResult>;
  cancel(uid: string, reason?: string): Promise<CancelResult>;
  reschedule(uid: string, newStartIso: string, reason?: string): Promise<RescheduleResult>;
}
