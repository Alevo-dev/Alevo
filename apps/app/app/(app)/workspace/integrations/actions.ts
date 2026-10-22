"use server";

import { revalidatePath } from "next/cache";
import { deleteOrgSecret, recordAudit, setOrgSecret } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole } from "@alevo/auth";
import { FIELD_PREFIX, getSecretSpec, isSecretKey, type SecretKey } from "@/lib/secrets-registry";
import { notifySlack } from "@/lib/notifications/slack";

export type ActionState = {
  ok?: boolean;
  error?: string; // form-level (non-field) error
  errors?: { value?: string }; // per-field error
  /** Echoed back so the field keeps its value on error (rule 13). */
  value?: string;
};

async function adminContext() {
  await requireRole("admin");
  const [org, me] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
  if (!org) throw new Error("No active organization");
  return { org, actorId: me?.id ?? null };
}

function fail(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

export type SaveSecretsState = {
  ok?: boolean;
  error?: string; // form-level (non-field) error
  /** Per-field errors, keyed by secret. Nothing is saved while any exist. */
  errors?: Partial<Record<SecretKey, string>>;
};

/** Saves every filled-in key in one submit. Blank fields keep their stored value. */
export async function saveSecrets(
  _prev: SaveSecretsState,
  formData: FormData,
): Promise<SaveSecretsState> {
  try {
    const { org, actorId } = await adminContext();
    const entries: { key: SecretKey; value: string }[] = [];
    for (const [name, raw] of formData.entries()) {
      if (typeof raw !== "string" || !name.startsWith(FIELD_PREFIX)) continue;
      const key = name.slice(FIELD_PREFIX.length);
      if (!isSecretKey(key)) return { error: "Unknown secret" };
      const value = raw.trim();
      if (value) entries.push({ key, value });
    }
    if (entries.length === 0) return { error: "Enter a value to save." };

    const errors: Partial<Record<SecretKey, string>> = {};
    for (const { key, value } of entries) {
      const formatError = getSecretSpec(key).validate?.(value);
      if (formatError) errors[key] = formatError;
    }
    if (Object.keys(errors).length > 0) return { errors };

    for (const { key, value } of entries) {
      await setOrgSecret(org.id, key, value);
      await recordAudit({
        orgId: org.id,
        actorUserId: actorId,
        action: "secret.set",
        target: key,
      });
    }
    revalidatePath("/workspace/integrations");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export async function sendTestSlack(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    const { org } = await adminContext();
    const result = await notifySlack(
      org.id,
      `:wave: Test notification from Alevo — ${org.name}.`,
    );
    if (!result.ok) return { error: result.error ?? "Failed to send" };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function clearSecret(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { org, actorId } = await adminContext();
    const key = String(formData.get("key") ?? "");
    if (!isSecretKey(key)) return { error: "Unknown secret" };
    await deleteOrgSecret(org.id, key);
    await recordAudit({
      orgId: org.id,
      actorUserId: actorId,
      action: "secret.cleared",
      target: key,
    });
    revalidatePath("/workspace/integrations");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
