"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { deleteOrgSecret, orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { isValidTimeZone } from "@/lib/cadence/send-window";

/** The "how it behaves" half of org_profiles. The business half lives under /workspace/profile. */
export type AgentValues = {
  enabled: boolean;
  timezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  smsFromNumber: string;
};
export type AgentErrors = Partial<Record<"enabled" | "timezone" | "sendWindow" | "smsFromNumber", string>>;
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: AgentErrors;
  values?: AgentValues;
};

/** E.164: a leading + and 8–15 digits (first digit 1–9). */
const E164 = /^\+[1-9]\d{7,14}$/;

function hour(formData: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isInteger(n) && n >= 0 && n <= 24 ? n : fallback;
}

function readValues(formData: FormData): AgentValues {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    enabled: Boolean(formData.get("enabled")),
    timezone: s("timezone"),
    sendWindowStartHour: hour(formData, "sendWindowStartHour", 8),
    sendWindowEndHour: hour(formData, "sendWindowEndHour", 20),
    smsFromNumber: s("smsFromNumber"),
  };
}

export async function saveAgentSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = readValues(formData);
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };

    const errors: AgentErrors = {};
    if (values.timezone && !isValidTimeZone(values.timezone)) errors.timezone = "Pick a valid timezone.";
    if (values.sendWindowStartHour >= values.sendWindowEndHour) {
      errors.sendWindow = "The start time must be before the end time.";
    }
    if (values.smsFromNumber && !E164.test(values.smsFromNumber)) {
      errors.smsFromNumber = "Use E.164 format, e.g. +15551234567.";
    }
    // Turning the agent on needs the business profile it reasons from.
    if (values.enabled) {
      const [profile] = await withOrg((tx) =>
        tx
          .select({ companyName: orgProfiles.companyName, offering: orgProfiles.offering, idealCustomer: orgProfiles.idealCustomer })
          .from(orgProfiles)
          .where(eq(orgProfiles.orgId, org.id))
          .limit(1),
      );
      if (!profile?.companyName || !profile.offering || !profile.idealCustomer) {
        errors.enabled = "Fill in the company name, offering and ideal customer under Business profile first.";
      }
    }
    if (Object.keys(errors).length > 0) return { errors, values };

    const nullable = (v: string) => (v ? v : null);
    const set = {
      enabled: values.enabled,
      timezone: nullable(values.timezone),
      sendWindowStartHour: values.sendWindowStartHour,
      sendWindowEndHour: values.sendWindowEndHour,
      smsFromNumber: nullable(values.smsFromNumber),
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

    revalidatePath("/workspace/agent");
    return { ok: true, values };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong", values };
  }
}

export type DisconnectState = { ok?: boolean; error?: string };

/**
 * Disconnect the connected booking calendar (Google / M365): drop the stored
 * refresh token and clear the profile's calendar fields. The agent then
 * falls back to Cal.com / Calendly / handoff per the usual precedence.
 */
export async function disconnectCalendar(_prev: DisconnectState, _formData: FormData): Promise<DisconnectState> {
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization." };

    const [profile] = await withOrg((tx) =>
      tx.select({ provider: orgProfiles.calendarProvider }).from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1),
    );
    if (profile?.provider === "google") {
      await deleteOrgSecret(org.id, "google_calendar_refresh_token");
    } else if (profile?.provider === "m365") {
      await deleteOrgSecret(org.id, "m365_calendar_refresh_token");
    }

    await withOrg((tx) =>
      tx
        .update(orgProfiles)
        .set({ calendarProvider: null, calendarId: null, calendarAccountEmail: null, updatedAt: new Date() })
        .where(eq(orgProfiles.orgId, org.id)),
    );

    const me = await getCurrentUser();
    await recordAudit({
      orgId: org.id,
      actorUserId: me?.id ?? null,
      action: "qualifier.calendar_disconnected",
      target: profile?.provider ?? "none",
    });

    revalidatePath("/workspace/agent");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
}
