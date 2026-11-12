"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { orgProfiles, pgErrorCode, recordAudit, safeErrorMessage } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { isValidTimeZone } from "@/lib/cadence/send-window";
import { applyVoice, type AfterHours } from "@/lib/voice/apply";
import { numberChanged } from "@/lib/voice/number";
import { cleanVoiceLabel, DEFAULT_VOICE, isVoice, VOICES } from "@/lib/voice/voices";

/** The "how it behaves" half of org_profiles. The business half lives under /workspace/profile. */
export type AgentValues = {
  enabled: boolean;
  timezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  smsFromNumber: string;
  /** Email the owners/admins every alert that goes to Slack (org_profiles.email_alerts). */
  emailAlerts: boolean;
  /** Phone calls on the SMS number (org_profiles.voice_enabled): turned on through Vapi after the rest is saved. */
  voiceEnabled: boolean;
  voiceAfterHours: AfterHours;
  /** Vapi built-in voices (see lib/voice/voices.ts); each call uses one at random. At least one. */
  voiceNames: string[];
  /** The name each voice goes by with callers, by voice id (as typed; blank = no name). */
  voiceLabels: Record<string, string>;
};
export type AgentErrors = Partial<Record<"enabled" | "timezone" | "sendWindow" | "smsFromNumber" | "voiceEnabled" | "voiceAfterHours" | "voiceNames" | "voiceLabels", string>>;
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: AgentErrors;
  /** The voices whose name is not valid, by voice id, each with its message. */
  labelErrors?: Record<string, string>;
  values?: AgentValues;
};

/** E.164: a leading + and 8–15 digits (first digit 1–9). */
const E164 = /^\+[1-9]\d{7,14}$/;

function hour(formData: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isInteger(n) && n >= 0 && n <= 24 ? n : fallback;
}

/** The ticked voices, known ones only and once each; the default when none is left. */
function chosenVoices(formData: FormData): string[] {
  const names = [...new Set(formData.getAll("voiceNames").map(String).filter(isVoice))];
  return names.length > 0 ? names : [DEFAULT_VOICE];
}

function readValues(formData: FormData): AgentValues {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    enabled: Boolean(formData.get("enabled")),
    timezone: s("timezone"),
    sendWindowStartHour: hour(formData, "sendWindowStartHour", 8),
    sendWindowEndHour: hour(formData, "sendWindowEndHour", 20),
    smsFromNumber: s("smsFromNumber"),
    emailAlerts: Boolean(formData.get("emailAlerts")),
    voiceEnabled: Boolean(formData.get("voiceEnabled")),
    voiceAfterHours: s("voiceAfterHours") === "take_message" ? "take_message" : "voicemail",
    voiceNames: chosenVoices(formData),
    voiceLabels: Object.fromEntries(VOICES.map((v) => [v.id, s(`voiceLabel_${v.id}`)])),
  };
}

export async function saveAgentSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = readValues(formData);
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };

    const loadProfile = async () => {
      const [row] = await withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1));
      return row;
    };
    const existing = await loadProfile();

    const errors: AgentErrors = {};
    if (values.timezone && !isValidTimeZone(values.timezone)) errors.timezone = "Pick a valid timezone.";
    if (values.sendWindowStartHour >= values.sendWindowEndHour) {
      errors.sendWindow = "The start time must be before the end time.";
    }
    if (values.smsFromNumber && !E164.test(values.smsFromNumber)) {
      errors.smsFromNumber = "Use E.164 format, e.g. +15551234567.";
    }
    const labels = Object.fromEntries(VOICES.map((v) => [v.id, cleanVoiceLabel(values.voiceLabels[v.id] ?? "")]));
    const labelErrors = Object.fromEntries(
      Object.entries(labels)
        .filter(([, name]) => name === null)
        .map(([id]) => [id, "Use letters, spaces, . ' and - only, up to 30 characters."]),
    );
    if (values.voiceEnabled && !values.smsFromNumber) errors.voiceEnabled = "Add an SMS number above to turn phone calls on.";
    // Turning the agent on needs the business profile it reasons from.
    if (values.enabled && (!existing?.companyName || !existing.offering || !existing.idealCustomer)) {
      errors.enabled = "Fill in the company name, offering and ideal customer under Business profile first.";
    }
    if (Object.keys(errors).length > 0 || Object.keys(labelErrors).length > 0) return { errors, labelErrors, values };

    const nullable = (v: string) => (v ? v : null);
    // The Vapi record follows the number: a changed or cleared number drops it and
    // switches calls off, so the old number never keeps reaching this org.
    const numberMoved = numberChanged(existing?.smsFromNumber ?? null, nullable(values.smsFromNumber));
    const set = {
      enabled: values.enabled,
      timezone: nullable(values.timezone),
      sendWindowStartHour: values.sendWindowStartHour,
      sendWindowEndHour: values.sendWindowEndHour,
      smsFromNumber: nullable(values.smsFromNumber),
      // Setting a number clears a "Not using phone" from the Getting started card.
      ...(values.smsFromNumber ? { phoneDeclined: false } : {}),
      emailAlerts: values.emailAlerts,
      voiceAfterHours: values.voiceAfterHours,
      voiceNames: values.voiceNames,
      voiceLabels: Object.fromEntries(Object.entries(labels).filter(([, name]) => name)) as Record<string, string>,
      // Turning calls on happens below, once Vapi has accepted it.
      ...(numberMoved ? { vapiPhoneNumberId: null, voiceEnabled: false } : {}),
      ...(values.voiceEnabled ? {} : { voiceEnabled: false }),
    };
    await withOrg((tx) =>
      tx
        .insert(orgProfiles)
        .values({ orgId: org.id, ...set })
        .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
    );

    const me = await getCurrentUser();
    await recordAudit({
      orgId: org.id,
      actorUserId: me?.id ?? null,
      action: "qualifier.profile_saved",
      target: values.enabled ? "enabled" : "disabled",
    });

    if (values.voiceEnabled) {
      // The number and settings above are saved either way; only the calls switch can fail here.
      try {
        const applied = await applyVoice({ org: { id: org.id, name: org.name }, profile: await loadProfile(), afterHours: values.voiceAfterHours });
        if (!applied.ok) return { errors: { voiceEnabled: applied.error }, values };
        await withOrg((tx) =>
          tx
            .update(orgProfiles)
            .set({ voiceEnabled: true, vapiAssistantId: applied.vapiAssistantId, vapiPhoneNumberId: applied.vapiPhoneNumberId, updatedAt: new Date() })
            .where(eq(orgProfiles.orgId, org.id)),
        );
      } catch (error) {
        Sentry.captureException(error);
        return { errors: { voiceEnabled: safeErrorMessage(error, "Phone calls could not be turned on.") }, values };
      }
    }
    if (Boolean(existing?.voiceEnabled) !== values.voiceEnabled) {
      await recordAudit({ orgId: org.id, actorUserId: me?.id ?? null, action: "voice.settings_saved", target: values.voiceEnabled ? "enabled" : "disabled" });
    }

    revalidatePath("/workspace/agent");
    return { ok: true, values };
  } catch (error) {
    // The number is unique across orgs (inbound SMS routes by it): 23505 = taken.
    if (values.smsFromNumber && pgErrorCode(error) === "23505") {
      return { errors: { smsFromNumber: "That number is already used by another organization." }, values };
    }
    return { error: safeErrorMessage(error, "Something went wrong"), values };
  }
}

