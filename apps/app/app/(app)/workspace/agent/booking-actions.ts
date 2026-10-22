"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listOrgSecretKeys, orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { eq } from "drizzle-orm";
import { readSecretFields, storeSecrets, validateSecrets, type SecretErrors } from "@/lib/secrets/save";

/** The tools an org can pick. `manual` exists on the enum but isn't a choice. */
export type BookingTool = "calcom" | "google" | "m365" | "calendly";

export type BookingValues = {
  enabled: boolean;
  tool: BookingTool;
  calcomEventTypeId: string;
  bookingLengthMin: number;
  bookingHoursStart: number;
  bookingHoursEnd: number;
};
export type BookingErrors = Partial<Record<"tool" | "calcomEventTypeId" | "bookingHours", string>> & SecretErrors;
export type BookingState = { ok?: boolean; error?: string; errors?: BookingErrors; values?: BookingValues };

const TOOLS: readonly BookingTool[] = ["calcom", "google", "m365", "calendly"];
const CALCOM_KEYS = ["calcom_api_key", "calcom_webhook_secret"] as const;

function hour(formData: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isInteger(n) && n >= 0 && n <= 24 ? n : fallback;
}

/** Meeting length in minutes; clamp to a sane 10–240 range. */
function length(formData: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isInteger(n) && n >= 10 && n <= 240 ? n : fallback;
}

function readValues(formData: FormData): BookingValues {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const tool = s("tool");
  return {
    enabled: Boolean(formData.get("enabled")),
    tool: (TOOLS as readonly string[]).includes(tool) ? (tool as BookingTool) : "calcom",
    calcomEventTypeId: s("calcomEventTypeId"),
    bookingLengthMin: length(formData, "bookingLengthMin", 30),
    bookingHoursStart: hour(formData, "bookingHoursStart", 9),
    bookingHoursEnd: hour(formData, "bookingHoursEnd", 17),
  };
}

/**
 * Validate + persist the Booking form. Turning booking off only clears the
 * choice; each tool's details stay stored so switching back is painless.
 */
async function persist(formData: FormData): Promise<BookingState> {
  const values = readValues(formData);
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };

    const errors: BookingErrors = {};
    const secrets = readSecretFields(formData, CALCOM_KEYS);
    Object.assign(errors, validateSecrets(secrets));
    if (values.bookingHoursStart >= values.bookingHoursEnd) {
      errors.bookingHours = "The earliest time must be before the latest.";
    }

    if (values.enabled && values.tool === "calcom") {
      if (!/^\d+$/.test(values.calcomEventTypeId)) {
        errors.calcomEventTypeId = "Enter the numeric Cal.com event type ID.";
      }
      const typed = secrets.some((s) => s.key === "calcom_api_key");
      if (!typed && !(await listOrgSecretKeys(org.id)).includes("calcom_api_key")) {
        errors.calcom_api_key = "Add your Cal.com API key.";
      }
    }
    if (values.enabled && values.tool === "calendly") {
      const [profile] = await withOrg((tx) =>
        tx.select({ calendlyUrl: orgProfiles.calendlyUrl }).from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1),
      );
      if (!profile?.calendlyUrl) errors.tool = "Add the Calendly scheduling link under Integrations first.";
    }
    if (Object.keys(errors).length > 0) return { errors, values };

    const me = await getCurrentUser();
    await storeSecrets(org.id, me?.id ?? null, secrets);

    const set = {
      bookingTool: values.enabled ? values.tool : null,
      ...(values.enabled && values.tool === "calcom"
        ? { calcomEventTypeId: Number.parseInt(values.calcomEventTypeId, 10) }
        : {}),
      ...(values.enabled && (values.tool === "google" || values.tool === "m365")
        ? {
            bookingLengthMin: values.bookingLengthMin,
            bookingHoursStart: values.bookingHoursStart,
            bookingHoursEnd: values.bookingHoursEnd,
          }
        : {}),
    };
    await withOrg((tx) =>
      tx
        .insert(orgProfiles)
        .values({ orgId: org.id, ...set })
        .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
    );

    await recordAudit({
      orgId: org.id,
      actorUserId: me?.id ?? null,
      action: "booking.settings_saved",
      target: values.enabled ? values.tool : "off",
    });

    revalidatePath("/workspace/agent");
    revalidatePath("/workspace/integrations");
    return { ok: true, values };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong", values };
  }
}

export async function saveBookingSettings(_prev: BookingState, formData: FormData): Promise<BookingState> {
  return persist(formData);
}

/**
 * "Connect Google Calendar / Microsoft 365" from inside the Booking form: save
 * the form first (so the choice isn't lost), then start the OAuth consent flow.
 */
export async function connectCalendar(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const result = await persist(formData);
  if (!result.ok) return result;
  const tool = result.values?.tool;
  if (tool !== "google" && tool !== "m365") {
    return { error: "Pick Google Calendar or Microsoft 365 first.", values: result.values };
  }
  redirect(tool === "google" ? "/api/oauth/google/start" : "/api/oauth/microsoft/start");
}
