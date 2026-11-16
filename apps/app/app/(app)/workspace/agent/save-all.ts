"use server";

import { saveAgentSettings, type ActionState } from "./actions";
import { saveBookingSettings, type BookingState } from "./booking-actions";

/** What the one Agent form returns: each half's own state, plus the form-level message. */
export type PageState = { ok?: boolean; error?: string; agent?: ActionState; booking?: BookingState };

/**
 * The Agent page is one form with one Save. The agent half goes first (it is the one that can
 * fail on the phone number or Vapi); the booking half only runs once that is saved.
 */
export async function saveAgentPage(_prev: PageState, formData: FormData): Promise<PageState> {
  const agent = await saveAgentSettings({}, formData);
  if (!agent.ok) return { agent, error: agent.error };
  const booking = await saveBookingSettings({}, formData);
  return { ok: booking.ok, agent, booking, error: booking.error };
}
