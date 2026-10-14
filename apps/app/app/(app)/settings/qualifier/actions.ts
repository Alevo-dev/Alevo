"use server";

import { revalidatePath } from "next/cache";
import { orgProfiles, recordAudit } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";

export type ProfileValues = {
  companyName: string;
  offering: string;
  idealCustomer: string;
  qualifyingCriteria: string;
  disqualifiers: string;
  tone: string;
  signoff: string;
  enabled: boolean;
};
/** Per-field errors — only enforced when the Qualifier is being enabled. */
export type ProfileErrors = {
  companyName?: string;
  offering?: string;
  idealCustomer?: string;
};
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: ProfileErrors;
  values?: ProfileValues;
};

function readValues(formData: FormData): ProfileValues {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    companyName: s("companyName"),
    offering: s("offering"),
    idealCustomer: s("idealCustomer"),
    qualifyingCriteria: s("qualifyingCriteria"),
    disqualifiers: s("disqualifiers"),
    tone: s("tone"),
    signoff: s("signoff"),
    enabled: Boolean(formData.get("enabled")),
  };
}

export async function saveProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = readValues(formData);
  try {
    await requireRole("admin");

    // Enabling the Qualifier requires enough context to reason well.
    if (values.enabled) {
      const errors: ProfileErrors = {};
      if (!values.companyName) errors.companyName = "Add your company name before enabling.";
      if (!values.offering) errors.offering = "Describe what you offer so replies are grounded.";
      if (!values.idealCustomer) errors.idealCustomer = "Define your ideal customer to score fit.";
      if (Object.keys(errors).length > 0) return { errors, values };
    }

    const org = await getCurrentOrg();
    if (!org) return { error: "No active organization.", values };
    const me = await getCurrentUser();

    // Empty optional fields are stored as NULL, not "".
    const nullable = (v: string) => (v ? v : null);
    await withOrg((tx) =>
      tx
        .insert(orgProfiles)
        .values({
          orgId: org.id,
          companyName: nullable(values.companyName),
          offering: nullable(values.offering),
          idealCustomer: nullable(values.idealCustomer),
          qualifyingCriteria: nullable(values.qualifyingCriteria),
          disqualifiers: nullable(values.disqualifiers),
          tone: nullable(values.tone),
          signoff: nullable(values.signoff),
          enabled: values.enabled,
        })
        .onConflictDoUpdate({
          target: orgProfiles.orgId,
          set: {
            companyName: nullable(values.companyName),
            offering: nullable(values.offering),
            idealCustomer: nullable(values.idealCustomer),
            qualifyingCriteria: nullable(values.qualifyingCriteria),
            disqualifiers: nullable(values.disqualifiers),
            tone: nullable(values.tone),
            signoff: nullable(values.signoff),
            enabled: values.enabled,
            updatedAt: new Date(),
          },
        }),
    );

    await recordAudit({
      orgId: org.id,
      actorUserId: me?.id ?? null,
      action: "qualifier.profile_saved",
      target: values.enabled ? "enabled" : "disabled",
    });

    revalidatePath("/settings/qualifier");
    return { ok: true, values };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
      values,
    };
  }
}
