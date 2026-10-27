"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { buildAssistantBody, VOICE_SECRET_HEADER, voiceServerUrl } from "@/lib/voice/assistant";
import { bookingLinked } from "@/lib/voice/schedule";
import { createAssistant, importTwilioNumber, isVapiConfigured, updateAssistant } from "@/lib/voice/vapi";

export type VoiceValues = { enabled: boolean; afterHours: "voicemail" | "take_message" };
export type VoiceErrors = Partial<Record<"enabled" | "afterHours", string>>;
export type VoiceState = { ok?: boolean; error?: string; errors?: VoiceErrors; values?: VoiceValues };

const AFTER_HOURS = ["voicemail", "take_message"] as const;

/**
 * Turn inbound calls on or off. On: create or update the Vapi assistant from the
 * business profile (a saved copy that validates the body and shows in Vapi's
 * dashboard), and import the org's number into Vapi once. The number is routed
 * per call through assistant-request, so Off needs no Vapi call: the webhook
 * answers "we're not taking calls right now".
 */
export async function saveVoiceSettings(_prev: VoiceState, formData: FormData): Promise<VoiceState> {
  const afterRaw = String(formData.get("afterHours") ?? "");
  const values: VoiceValues = {
    enabled: formData.get("enabled") === "on",
    afterHours: (AFTER_HOURS as readonly string[]).includes(afterRaw)
      ? (afterRaw as VoiceValues["afterHours"])
      : "voicemail",
  };

  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };

    const [profile] = await withOrg((tx) =>
      tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1),
    );
    let vapiAssistantId = profile?.vapiAssistantId ?? null;
    let vapiPhoneNumberId = profile?.vapiPhoneNumberId ?? null;

    if (values.enabled) {
      if (!profile || !profile.companyName || !profile.offering || !profile.idealCustomer) {
        return {
          errors: { enabled: "Fill in the company name, offering and ideal customer under Business profile first." },
          values,
        };
      }
      if (!profile.smsFromNumber) {
        return {
          errors: { enabled: "Set the organization's phone number under Agent first, then turn calls on." },
          values,
        };
      }
      if (!isVapiConfigured()) return { error: "Phone calls aren't set up on this environment yet.", values };
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const secret = process.env.VOICE_WEBHOOK_SECRET;
      if (!appUrl || !secret) {
        return { error: "Phone calls need NEXT_PUBLIC_APP_URL and VOICE_WEBHOOK_SECRET set.", values };
      }

      const body = buildAssistantBody({
        profile: { ...profile, voiceAfterHours: values.afterHours },
        orgName: org.name,
        mode: "open",
        bookingConnected: bookingLinked(profile),
        appUrl,
        secret,
      });
      if (vapiAssistantId) {
        await updateAssistant(vapiAssistantId, body);
      } else {
        vapiAssistantId = (await createAssistant(body)).id;
      }
      if (!vapiPhoneNumberId) {
        const imported = await importTwilioNumber({
          number: profile.smsFromNumber,
          name: `${org.name} inbound`,
          serverUrl: voiceServerUrl(appUrl),
          secretHeader: VOICE_SECRET_HEADER,
          secret,
        });
        vapiPhoneNumberId = imported.id;
      }
    }

    await withOrg((tx) =>
      tx
        .update(orgProfiles)
        .set({
          voiceEnabled: values.enabled,
          voiceAfterHours: values.afterHours,
          vapiAssistantId,
          vapiPhoneNumberId,
          updatedAt: new Date(),
        })
        .where(eq(orgProfiles.orgId, org.id)),
    );

    const me = await getCurrentUser();
    await recordAudit({
      orgId: org.id,
      actorUserId: me?.id ?? null,
      action: "voice.settings_saved",
      target: values.enabled ? "enabled" : "disabled",
    });

    revalidatePath("/workspace/agent");
    return { ok: true, values };
  } catch (error) {
    Sentry.captureException(error);
    return { error: error instanceof Error ? error.message : "Something went wrong", values };
  }
}
