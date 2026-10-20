"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { deleteOrgSecret, orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { isValidTimeZone } from "@/lib/cadence/send-window";

export type ProfileValues = {
  companyName: string;
  offering: string;
  idealCustomer: string;
  qualifyingCriteria: string;
  disqualifiers: string;
  tone: string;
  signoff: string;
  enabled: boolean;
  timezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  smsFromNumber: string;
  calcomEventTypeId: string;
  calendlyUrl: string;
  bookingLengthMin: number;
  bookingHoursStart: number;
  bookingHoursEnd: number;
};
/** Per-field errors — only enforced when the Qualifier is being enabled. */
export type ProfileErrors = {
  companyName?: string;
  offering?: string;
  idealCustomer?: string;
  timezone?: string;
  sendWindow?: string;
  smsFromNumber?: string;
  calcomEventTypeId?: string;
  calendlyUrl?: string;
  bookingHours?: string;
};

/** E.164: a leading + and 8–15 digits (first digit 1–9). */
const E164 = /^\+[1-9]\d{7,14}$/;

function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: ProfileErrors;
  values?: ProfileValues;
};

/** Default send window (local hours): 8am–8pm. */
const DEFAULT_START = 8;
const DEFAULT_END = 20;

function hour(formData: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isInteger(n) && n >= 0 && n <= 24 ? n : fallback;
}

function readValues(formData: FormData): ProfileValues {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    companyName: s("companyName"),
    offering: s("offering"),
    idealCustomer: s("idealCustomer"),
    qualifyingCriteria: s("qualifyingCriteria"),
    disqualifiers: s("disqualifiers"),
    tone: s("tone"),
    signoff: s("signoff"),
    enabled: Boolean(formData.get("enabled")),
    timezone: s("timezone"),
    sendWindowStartHour: hour(formData, "sendWindowStartHour", DEFAULT_START),
    sendWindowEndHour: hour(formData, "sendWindowEndHour", DEFAULT_END),
    smsFromNumber: s("smsFromNumber"),
    calcomEventTypeId: s("calcomEventTypeId"),
    calendlyUrl: s("calendlyUrl"),
    bookingLengthMin: length(formData, "bookingLengthMin", 30),
    bookingHoursStart: hour(formData, "bookingHoursStart", 9),
    bookingHoursEnd: hour(formData, "bookingHoursEnd", 17),
  };
}

/** Meeting length in minutes; clamp to a sane 10–240 range. */
function length(formData: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isInteger(n) && n >= 10 && n <= 240 ? n : fallback;
}

export async function saveProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readValues(formData);
  try {
    await requireRole("admin");

    // Send-window checks run always (they have defaults, but reject bad input).
    const errors: ProfileErrors = {};
    if (values.timezone && !isValidTimeZone(values.timezone)) {
      errors.timezone = "Pick a valid timezone.";
    }
    if (values.sendWindowStartHour >= values.sendWindowEndHour) {
      errors.sendWindow = "The start time must be before the end time.";
    }
    if (values.smsFromNumber && !E164.test(values.smsFromNumber)) {
      errors.smsFromNumber = "Use E.164 format, e.g. +15551234567.";
    }
    if (values.calcomEventTypeId && !/^\d+$/.test(values.calcomEventTypeId)) {
      errors.calcomEventTypeId = "Enter the numeric Cal.com event type ID.";
    }
    if (values.calendlyUrl && !isHttpsUrl(values.calendlyUrl)) {
      errors.calendlyUrl = "Enter a valid https Calendly link.";
    }
    if (values.bookingHoursStart >= values.bookingHoursEnd) {
      errors.bookingHours = "The earliest time must be before the latest.";
    }
    // Enabling the Qualifier requires enough context to reason well.
    if (values.enabled) {
      if (!values.companyName) errors.companyName = "Add your company name before enabling.";
      if (!values.offering) errors.offering = "Describe what you offer so replies are grounded.";
      if (!values.idealCustomer) errors.idealCustomer = "Define your ideal customer to score fit.";
    }
    if (Object.keys(errors).length > 0) return { errors, values };

    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };
    const me = await getCurrentUser();

    // Empty optional fields are stored as NULL, not "".
    const nullable = (v: string) => (v ? v : null);
    await withOrg((tx) =>
      tx
        .insert(orgProfiles)
        .values({
          orgId: org.id,
          companyName: nullable(values.companyName),
          offering: nullable(values.offering),
          idealCustomer: nullable(values.idealCustomer),
          qualifyingCriteria: nullable(values.qualifyingCriteria),
          disqualifiers: nullable(values.disqualifiers),
          tone: nullable(values.tone),
          signoff: nullable(values.signoff),
          enabled: values.enabled,
          timezone: nullable(values.timezone),
          sendWindowStartHour: values.sendWindowStartHour,
          sendWindowEndHour: values.sendWindowEndHour,
          smsFromNumber: nullable(values.smsFromNumber),
          calcomEventTypeId: values.calcomEventTypeId
            ? Number.parseInt(values.calcomEventTypeId, 10)
            : null,
          calendlyUrl: nullable(values.calendlyUrl),
          bookingLengthMin: values.bookingLengthMin,
          bookingHoursStart: values.bookingHoursStart,
          bookingHoursEnd: values.bookingHoursEnd,
        })
        .onConflictDoUpdate({
          target: orgProfiles.orgId,
          set: {
            companyName: nullable(values.companyName),
            offering: nullable(values.offering),
            idealCustomer: nullable(values.idealCustomer),
            qualifyingCriteria: nullable(values.qualifyingCriteria),
            disqualifiers: nullable(values.disqualifiers),
            tone: nullable(values.tone),
            signoff: nullable(values.signoff),
            enabled: values.enabled,
            timezone: nullable(values.timezone),
            sendWindowStartHour: values.sendWindowStartHour,
            sendWindowEndHour: values.sendWindowEndHour,
            smsFromNumber: nullable(values.smsFromNumber),
            calcomEventTypeId: values.calcomEventTypeId
              ? Number.parseInt(values.calcomEventTypeId, 10)
              : null,
            calendlyUrl: nullable(values.calendlyUrl),
            bookingLengthMin: values.bookingLengthMin,
            bookingHoursStart: values.bookingHoursStart,
            bookingHoursEnd: values.bookingHoursEnd,
            updatedAt: new Date(),
          },
        }),
    );

    await recordAudit({
      orgId: org.id,
      actorUserId: me?.id ?? null,
      action: "qualifier.profile_saved",
      target: values.enabled ? "enabled" : "disabled",
    });

    revalidatePath("/settings/qualifier");
    return { ok: true, values };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
      values,
    };
  }
}

export type DisconnectState = { ok?: boolean; error?: string };

/**
 * Disconnect the connected booking calendar (Google / M365): drop the stored
 * refresh token and clear the profile's calendar fields. The Qualifier then
 * falls back to Cal.com / Calendly / handoff per the usual precedence.
 */
export async function disconnectCalendar(
  _prev: DisconnectState,
  _formData: FormData,
): Promise<DisconnectState> {
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization." };

    const [profile] = await withOrg((tx) =>
      tx
        .select({ provider: orgProfiles.calendarProvider })
        .from(orgProfiles)
        .where(eq(orgProfiles.orgId, org.id))
        .limit(1),
    );
    if (profile?.provider === "google") {
      await deleteOrgSecret(org.id, "google_calendar_refresh_token");
    } else if (profile?.provider === "m365") {
      await deleteOrgSecret(org.id, "m365_calendar_refresh_token");
    }

    await withOrg((tx) =>
      tx
        .update(orgProfiles)
        .set({
          calendarProvider: null,
          calendarId: null,
          calendarAccountEmail: null,
          updatedAt: new Date(),
        })
        .where(eq(orgProfiles.orgId, org.id)),
    );

    const me = await getCurrentUser();
    await recordAudit({
      orgId: org.id,
      actorUserId: me?.id ?? null,
      action: "qualifier.calendar_disconnected",
      target: profile?.provider ?? "none",
    });

    revalidatePath("/settings/qualifier");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
}
