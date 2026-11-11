"use server";

import { revalidatePath } from "next/cache";
import { isDeclineKey, recordAudit, setSetupDecline, safeErrorMessage } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole } from "@alevo/auth";

export type SetupState = { ok?: boolean; error?: string };

/** "Not using this" (or back) for Booking / Phone / Slack on the Getting started card. Admin+. */
export async function declineSetupItem(_prev: SetupState, formData: FormData): Promise<SetupState> {
  try {
    await requireRole("admin");
    const key = formData.get("key");
    const value = String(formData.get("value")) === "true";
    if (!isDeclineKey(key)) return { error: "Unknown item" };
    const [org, me] = await Promise.all([getCurrentOrg(), getCurrentUser()]);
    if (!org) return { error: "No active organization" };
    await setSetupDecline(org.id, key, value); // upsert: a new workspace has no profile row yet
    await recordAudit({ orgId: org.id, actorUserId: me?.id ?? null, action: value ? "setup.declined" : "setup.undeclined", target: key });
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong") };
  }
}
