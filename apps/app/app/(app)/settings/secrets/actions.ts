"use server";

import { revalidatePath } from "next/cache";
import { deleteOrgSecret, recordAudit, setOrgSecret } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole } from "@alevo/auth";
import { getSecretSpec, isSecretKey } from "@/lib/secrets-registry";
import { notifySlack } from "@/lib/notifications/slack";

export type ActionState = { ok?: boolean; error?: string };

async function adminContext() {
  await requireRole("admin");
  const [org, me] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
  if (!org) throw new Error("No active organization");
  return { org, actorId: me?.id ?? null };
}

function fail(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

export async function saveSecret(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { org, actorId } = await adminContext();
    const key = String(formData.get("key") ?? "");
    const value = String(formData.get("value") ?? "").trim();
    if (!isSecretKey(key)) return { error: "Unknown secret" };
    if (!value) return { error: "Value is required" };
    const formatError = getSecretSpec(key).validate?.(value);
    if (formatError) return { error: formatError };
    await setOrgSecret(org.id, key, value);
    await recordAudit({
      orgId: org.id,
      actorUserId: actorId,
      action: "secret.set",
      target: key,
    });
    revalidatePath("/settings/secrets");
    return { ok: true };
  } catch (error) {
    return fail(error);
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
    revalidatePath("/settings/secrets");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
