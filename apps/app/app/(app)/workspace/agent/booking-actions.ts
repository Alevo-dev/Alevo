"use server";

import { revalidatePath } from "next/cache";
import { listOrgSecretKeys, orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { eq } from "drizzle-orm";
import { bookingSnapshot, connectedBookingTools, isBookingTool, type BookingTool } from "@/lib/booking/connected";

export type { BookingTool } from "@/lib/booking/connected";

/** Booking behaviour only — each tool's connection lives under Integrations. */
export type BookingValues = {
  enabled: boolean;
  tool: BookingTool | null;
  bookingLengthMin: number;
  bookingHoursStart: number;
  bookingHoursEnd: number;
};
export type BookingErrors = Partial<Record<"tool" | "bookingHours", string>>;
export type BookingState = { ok?: boolean; error?: string; errors?: BookingErrors; values?: BookingValues };

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
  const tool = String(formData.get("tool") ?? "").trim();
  return {
    enabled: Boolean(formData.get("enabled")),
    tool: isBookingTool(tool) ? tool : null,
    bookingLengthMin: length(formData, "bookingLengthMin", 30),
    bookingHoursStart: hour(formData, "bookingHoursStart", 9),
    bookingHoursEnd: hour(formData, "bookingHoursEnd", 17),
  };
}

/**
 * Validate + persist the Booking section. The chosen tool must be one that is
 * connected under Integrations (re-derived here, never trusted from the form).
 * Turning booking off only clears the choice; every connection stays as it is.
 */
export async function saveBookingSettings(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const values = readValues(formData);
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };

    const errors: BookingErrors = {};
    if (values.bookingHoursStart >= values.bookingHoursEnd) {
      errors.bookingHours = "The earliest time must be before the latest.";
    }
    if (values.enabled) {
      const [[row], setKeys] = await Promise.all([
        withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)),
        listOrgSecretKeys(org.id),
      ]);
      const connected = connectedBookingTools(bookingSnapshot(row), (k) => setKeys.includes(k));
      if (!values.tool || !connected.some((c) => c.tool === values.tool)) {
        errors.tool = "Connect a booking tool under Integrations first.";
      }
    }
    if (Object.keys(errors).length > 0) return { errors, values };

    const tool = values.enabled ? values.tool : null;
    const set = {
      bookingTool: tool,
      ...(tool === "google" || tool === "m365"
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

    const me = await getCurrentUser();
    await recordAudit({ orgId: org.id, actorUserId: me?.id ?? null, action: "booking.settings_saved", target: tool ?? "off" });

    revalidatePath("/workspace/agent");
    revalidatePath("/workspace/integrations");
    return { ok: true, values };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong", values };
  }
}
