import "server-only";
import type { OrgProfile } from "@alevo/db";
import { buildAssistantBody, VOICE_SECRET_HEADER, voiceServerUrl } from "./assistant";
import { bookingLinked } from "./schedule";
import { releaseVapiNumber } from "./release";
import { createAssistant, detachAssistantFromNumber, importTwilioNumber, isVapiConfigured, updateAssistant } from "./vapi";

export type AfterHours = "voicemail" | "take_message";
export type VoiceApplied =
  | { ok: true; vapiAssistantId: string; vapiPhoneNumberId: string }
  | { ok: false; error: string };

/**
 * Turn inbound calls ON for an org whose profile (number included) is already saved:
 * create or update the Vapi assistant from the business profile (a saved copy that
 * validates the body and shows in Vapi's dashboard), import the number into Vapi once
 * (or re-assert our routing on its existing record), and take the record away from any
 * other org that still held it. Off needs no Vapi call: the webhook answers "not in
 * service". Returns a person-readable `error` for a precondition; a Vapi failure throws.
 */
export async function applyVoice(args: {
  org: { id: string; name: string };
  profile: OrgProfile | undefined;
  afterHours: AfterHours;
}): Promise<VoiceApplied> {
  const { org, profile, afterHours } = args;
  if (!profile || !profile.companyName || !profile.offering || !profile.idealCustomer) {
    return { ok: false, error: "Fill in the company name, offering and ideal customer under Business profile first." };
  }
  if (!profile.smsFromNumber) return { ok: false, error: "Add the organization's SMS number first." };
  if (!isVapiConfigured()) return { ok: false, error: "Phone calls aren't set up on this environment yet." };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!appUrl || !secret) return { ok: false, error: "Phone calls need NEXT_PUBLIC_APP_URL and VOICE_WEBHOOK_SECRET set." };

  const body = buildAssistantBody({
    profile: { ...profile, voiceAfterHours: afterHours },
    orgName: org.name,
    mode: "open",
    bookingConnected: bookingLinked(profile),
    appUrl,
    secret,
  });
  const vapiAssistantId = profile.vapiAssistantId
    ? (await updateAssistant(profile.vapiAssistantId, body), profile.vapiAssistantId)
    : (await createAssistant(body)).id;

  const routing = { serverUrl: voiceServerUrl(appUrl), secretHeader: VOICE_SECRET_HEADER, secret };
  let vapiPhoneNumberId = profile.vapiPhoneNumberId;
  if (!vapiPhoneNumberId) {
    vapiPhoneNumberId = (await importTwilioNumber({ number: profile.smsFromNumber, name: `${org.name} inbound`, ...routing })).id;
  } else {
    // A number that has an assistant attached (dashboard edit, older import)
    // never asks us which assistant to use — every call gets the stale one.
    await detachAssistantFromNumber({ phoneNumberId: vapiPhoneNumberId, ...routing });
  }
  await releaseVapiNumber(org.id, vapiPhoneNumberId);
  return { ok: true, vapiAssistantId, vapiPhoneNumberId };
}
