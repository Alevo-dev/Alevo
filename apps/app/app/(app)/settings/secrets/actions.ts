"use server";

import { revalidatePath } from "next/cache";
import { deleteOrgSecret, setOrgSecret } from "@alevo/db";
import { getCurrentOrg, requireRole } from "@alevo/auth";
import { isSecretKey } from "@/lib/secrets-registry";

export type ActionState = { ok?: boolean; error?: string };

async function adminOrg() {
  await requireRole("admin");
  const org = await getCurrentOrg();
  if (!org) throw new Error("No active organization");
  return org;
}

function fail(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "Something went wrong" };
}

export async function saveSecret(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const org = await adminOrg();
    const key = String(formData.get("key") ?? "");
    const value = String(formData.get("value") ?? "").trim();
    if (!isSecretKey(key)) return { error: "Unknown secret" };
    if (!value) return { error: "Value is required" };
    await setOrgSecret(org.id, key, value);
    revalidatePath("/settings/secrets");
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
    const org = await adminOrg();
    const key = String(formData.get("key") ?? "");
    if (!isSecretKey(key)) return { error: "Unknown secret" };
    await deleteOrgSecret(org.id, key);
    revalidatePath("/settings/secrets");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
