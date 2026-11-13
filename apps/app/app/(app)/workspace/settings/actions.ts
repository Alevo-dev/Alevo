"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { orgProfiles, recordAudit, safeErrorMessage } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { TONE_KEYS } from "@/lib/profile/tone";

const MAX_SIGNOFF_CHARS = 80;

export type ToneState = {
  ok?: boolean;
  error?: string;
  errors?: { tone?: string; signoff?: string };
  values?: { tone: string; signoff: string };
};

/** How the agent sounds and signs off. Its own save: the profile form no longer carries these two. */
export async function saveToneAndSignoff(_prev: ToneState, formData: FormData): Promise<ToneState> {
  const values = { tone: String(formData.get("tone") ?? "").trim(), signoff: String(formData.get("signoff") ?? "").trim() };
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };

    // A preset, blank, or the old free-text tone an org may still have saved (the dropdown shows it as "Custom").
    const [current] = await withOrg((tx) => tx.select({ tone: orgProfiles.tone }).from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1));
    const errors: NonNullable<ToneState["errors"]> = {};
    if (values.tone && !TONE_KEYS.includes(values.tone) && values.tone !== current?.tone) errors.tone = "Pick one of the tones in the list.";
    if (values.signoff.length > MAX_SIGNOFF_CHARS) errors.signoff = `Keep the sign-off under ${MAX_SIGNOFF_CHARS} characters.`;
    if (Object.keys(errors).length > 0) return { errors, values };

    const set = { tone: values.tone || null, signoff: values.signoff || null };
    await withOrg((tx) =>
      tx
        .insert(orgProfiles)
        .values({ orgId: org.id, ...set })
        .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
    );
    await recordAudit({ orgId: org.id, actorUserId: (await getCurrentUser())?.id ?? null, action: "workspace.tone_saved", target: values.tone || "none" });
    revalidatePath("/workspace/settings");
    return { ok: true, values };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong"), values };
  }
}
