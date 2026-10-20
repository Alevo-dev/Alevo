"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";

/** The "who we are" half of org_profiles: what the agent grounds replies in. */
export type BusinessProfileValues = {
  companyName: string;
  offering: string;
  idealCustomer: string;
  qualifyingCriteria: string;
  disqualifiers: string;
  tone: string;
  signoff: string;
};
export type BusinessProfileErrors = Partial<Record<"companyName" | "offering" | "idealCustomer", string>>;
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: BusinessProfileErrors;
  values?: BusinessProfileValues;
};

function readValues(formData: FormData): BusinessProfileValues {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    companyName: s("companyName"),
    offering: s("offering"),
    idealCustomer: s("idealCustomer"),
    qualifyingCriteria: s("qualifyingCriteria"),
    disqualifiers: s("disqualifiers"),
    tone: s("tone"),
    signoff: s("signoff"),
  };
}

export async function saveBusinessProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = readValues(formData);
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };

    // While the agent is on, the three fields it reasons from stay required.
    const [current] = await withOrg((tx) =>
      tx.select({ enabled: orgProfiles.enabled }).from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1),
    );
    if (current?.enabled) {
      const errors: BusinessProfileErrors = {};
      const need = "Required while the agent is on. Turn it off under Agent to leave this blank.";
      if (!values.companyName) errors.companyName = need;
      if (!values.offering) errors.offering = need;
      if (!values.idealCustomer) errors.idealCustomer = need;
      if (Object.keys(errors).length > 0) return { errors, values };
    }

    // Empty optional fields are stored as NULL, not "".
    const nullable = (v: string) => (v ? v : null);
    const set = {
      companyName: nullable(values.companyName),
      offering: nullable(values.offering),
      idealCustomer: nullable(values.idealCustomer),
      qualifyingCriteria: nullable(values.qualifyingCriteria),
      disqualifiers: nullable(values.disqualifiers),
      tone: nullable(values.tone),
      signoff: nullable(values.signoff),
    };
    await withOrg((tx) =>
      tx
        .insert(orgProfiles)
        .values({ orgId: org.id, ...set })
        .onConflictDoUpdate({ target: orgProfiles.orgId, set: { ...set, updatedAt: new Date() } }),
    );

    const me = await getCurrentUser();
    await recordAudit({ orgId: org.id, actorUserId: me?.id ?? null, action: "workspace.profile_saved", target: org.id });

    revalidatePath("/workspace/profile");
    return { ok: true, values };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong", values };
  }
}
