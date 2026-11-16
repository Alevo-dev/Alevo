"use server";

import { saveBrandColour, type BrandColourState } from "../integrations/actions";
import { saveToneAndSignoff, type ToneState } from "./actions";

/** What the one Brand form returns: each half's own state, plus the form-level message. */
export type BrandPageState = { ok?: boolean; error?: string; tone?: ToneState; colour?: BrandColourState };

/**
 * The Brand page is one form with one Save. Tone and sign-off go first; the colours only run once that is
 * saved, so a mistake in the first half is fixed before anything else is written.
 */
export async function saveBrandPage(_prev: BrandPageState, formData: FormData): Promise<BrandPageState> {
  const tone = await saveToneAndSignoff({}, formData);
  if (!tone.ok) return { tone, error: tone.error };
  const colour = await saveBrandColour({}, formData);
  return { ok: colour.ok, tone, colour, error: colour.error };
}
