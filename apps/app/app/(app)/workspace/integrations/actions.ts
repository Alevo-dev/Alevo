"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { deleteOrgSecret, orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { isSecretKey } from "@/lib/secrets-registry";
import { readSecretFields, storeSecrets, validateSecrets, type SecretErrors } from "@/lib/secrets/save";
import { notifySlack } from "@/lib/notifications/slack";

export type ActionState = {
  ok?: boolean;
  error?: string; // form-level (non-field) error
};

async function adminContext() {
  await requireRole("admin");
  const [org, me] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
  if (!org) throw new Error("No active organization");
  return { org, actorId: me?.id ?? null };
}

function fail(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

function revalidateBoth() {
  revalidatePath("/workspace/integrations");
  revalidatePath("/workspace/agent");
}

/** Upsert the org's profile row with these booking-related fields. */
async function upsertProfile(orgId: string, set: Partial<typeof orgProfiles.$inferInsert>) {
  await withOrg((tx) =>
    tx
      .insert(orgProfiles)
      .values({ orgId, ...set })
      .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
  );
}

/** A tool that just lost what it needs stops being the chosen booking tool. */
async function unchooseBookingTool(orgId: string, tool: "calcom" | "google" | "m365" | "calendly") {
  await withOrg((tx) =>
    tx
      .update(orgProfiles)
      .set({ bookingTool: null, updatedAt: new Date() })
      .where(and(eq(orgProfiles.orgId, orgId), eq(orgProfiles.bookingTool, tool))),
  );
}

export type SaveSecretsState = {
  ok?: boolean;
  error?: string;
  /** Per-field errors, keyed by secret. Nothing is saved while any exist. */
  errors?: SecretErrors;
};

/** Saves every filled-in key in one submit. Blank fields keep their stored value. */
export async function saveSecrets(_prev: SaveSecretsState, formData: FormData): Promise<SaveSecretsState> {
  try {
    const { org, actorId } = await adminContext();
    const entries = readSecretFields(formData);
    if (entries.length === 0) return { error: "Enter a value to save." };
    const errors = validateSecrets(entries);
    if (Object.keys(errors).length > 0) return { errors };
    await storeSecrets(org.id, actorId, entries);
    revalidatePath("/workspace/integrations");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function sendTestSlack(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const { org } = await adminContext();
    const result = await notifySlack(org.id, `:wave: Test notification from Alevo — ${org.name}.`);
    if (!result.ok) return { error: result.error ?? "Failed to send" };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function clearSecret(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { org, actorId } = await adminContext();
    const key = String(formData.get("key") ?? "");
    if (!isSecretKey(key)) return { error: "Unknown secret" };
    await deleteOrgSecret(org.id, key);
    // Without its API key Cal.com can't book, so it can't stay the booking tool.
    if (key === "calcom_api_key") await unchooseBookingTool(org.id, "calcom");
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "secret.cleared", target: key });
    revalidateBoth();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export type CalcomState = {
  ok?: boolean;
  error?: string;
  errors?: { calcomEventTypeId?: string } & SecretErrors;
  values?: { calcomEventTypeId: string };
};

/** Cal.com's event type (profile) + API key + webhook secret (secrets), one submit. */
export async function saveCalcom(_prev: CalcomState, formData: FormData): Promise<CalcomState> {
  const calcomEventTypeId = String(formData.get("calcomEventTypeId") ?? "").trim();
  const values = { calcomEventTypeId };
  try {
    const { org, actorId } = await adminContext();
    const entries = readSecretFields(formData, ["calcom_api_key", "calcom_webhook_secret"]);
    const errors: CalcomState["errors"] = validateSecrets(entries);
    if (calcomEventTypeId && !/^\d+$/.test(calcomEventTypeId)) errors.calcomEventTypeId = "Enter the numeric Cal.com event type ID.";
    if (Object.keys(errors).length > 0) return { errors, values };

    await storeSecrets(org.id, actorId, entries);
    const id = calcomEventTypeId ? Number.parseInt(calcomEventTypeId, 10) : null;
    await upsertProfile(org.id, { calcomEventTypeId: id });
    if (id === null) await unchooseBookingTool(org.id, "calcom");
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "calcom.settings_saved", target: id === null ? "no event type" : `event type ${id}` });
    revalidateBoth();
    return { ok: true, values };
  } catch (error) {
    return { ...fail(error), values };
  }
}

export type CalendlyState = {
  ok?: boolean;
  error?: string;
  errors?: { calendlyUrl?: string } & SecretErrors;
  values?: { calendlyUrl: string };
};

function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

/** Calendly's scheduling link (profile) + webhook signing key (secret), one submit. */
export async function saveCalendly(_prev: CalendlyState, formData: FormData): Promise<CalendlyState> {
  const calendlyUrl = String(formData.get("calendlyUrl") ?? "").trim();
  const values = { calendlyUrl };
  try {
    const { org, actorId } = await adminContext();
    const entries = readSecretFields(formData, ["calendly_webhook_secret"]);
    const errors: CalendlyState["errors"] = validateSecrets(entries);
    if (calendlyUrl && !isHttpsUrl(calendlyUrl)) errors.calendlyUrl = "Enter a valid https Calendly link.";
    if (Object.keys(errors).length > 0) return { errors, values };

    await storeSecrets(org.id, actorId, entries);
    await upsertProfile(org.id, { calendlyUrl: calendlyUrl || null });
    if (!calendlyUrl) await unchooseBookingTool(org.id, "calendly");
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "calendly.settings_saved", target: calendlyUrl ? "link" : "no link" });
    revalidateBoth();
    return { ok: true, values };
  } catch (error) {
    return { ...fail(error), values };
  }
}

/**
 * Disconnect the connected booking calendar (Google / M365): drop the stored
 * refresh token, clear the profile's calendar fields, and un-choose it as the
 * booking tool so the agent hands off until another tool is chosen.
 */
export async function disconnectCalendar(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const { org, actorId } = await adminContext();
    const [profile] = await withOrg((tx) =>
      tx.select({ provider: orgProfiles.calendarProvider }).from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1),
    );
    const provider = profile?.provider === "google" || profile?.provider === "m365" ? profile.provider : null;
    if (provider) await deleteOrgSecret(org.id, `${provider}_calendar_refresh_token`);

    await withOrg((tx) =>
      tx
        .update(orgProfiles)
        .set({ calendarProvider: null, calendarId: null, calendarAccountEmail: null, updatedAt: new Date() })
        .where(eq(orgProfiles.orgId, org.id)),
    );
    if (provider) await unchooseBookingTool(org.id, provider);

    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "qualifier.calendar_disconnected", target: provider ?? "none" });
    revalidateBoth();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
