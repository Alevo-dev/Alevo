"use server";

import { revalidatePath } from "next/cache";
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
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "secret.cleared", target: key });
    revalidatePath("/workspace/integrations");
    return { ok: true };
  } catch (error) {
    return fail(error);
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
    const set = { calendlyUrl: calendlyUrl || null };
    await withOrg((tx) =>
      tx
        .insert(orgProfiles)
        .values({ orgId: org.id, ...set })
        .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
    );
    await recordAudit({ orgId: org.id, actorUserId: actorId, action: "calendly.settings_saved", target: calendlyUrl ? "link" : "no link" });
    revalidatePath("/workspace/integrations");
    revalidatePath("/workspace/agent");
    return { ok: true, values };
  } catch (error) {
    return { ...fail(error), values };
  }
}
