"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { hitRateLimit, orgProfiles, recordAudit, safeErrorMessage } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { crawlSite } from "@/lib/profile/crawl";
import { extractProfile } from "@/lib/profile/extract";
import { ImportError, importMessage } from "@/lib/profile/import-error";
import type { ImportedProfile } from "@/lib/profile/merge";

/** The "who we are" half of org_profiles: what the agent grounds replies in. */
export type BusinessProfileValues = {
  companyName: string;
  businessAddress: string;
  contactEmail: string;
  contactPhone: string;
  contactHours: string;
  offering: string;
  idealCustomer: string;
  qualifyingCriteria: string;
  disqualifiers: string;
  tone: string;
  signoff: string;
};
export type BusinessProfileErrors = Partial<Record<"companyName" | "businessAddress" | "contactEmail" | "offering" | "idealCustomer", string>>;
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
    businessAddress: s("businessAddress"),
    contactEmail: s("contactEmail"),
    contactPhone: s("contactPhone"),
    contactHours: s("contactHours"),
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

    // Optional, but if given it must be an address a visitor can write to.
    if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) {
      return { errors: { contactEmail: "Enter a valid email address." }, values };
    }

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
      businessAddress: nullable(values.businessAddress),
      contactEmail: nullable(values.contactEmail),
      contactPhone: nullable(values.contactPhone),
      contactHours: nullable(values.contactHours),
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
    return { error: safeErrorMessage(error, "Something went wrong"), values };
  }
}

export type ImportResult = { ok: true; imported: ImportedProfile } | { ok: false; error: string };

/**
 * Read the company's website and return profile values for the form. Writes
 * nothing: the admin reviews the filled form and saves it the usual way.
 */
export async function importFromWebsite(url: string): Promise<ImportResult> {
  let orgId: string;
  let actorUserId: string | null;
  try {
    await requireRole("admin");
    const org = await getCurrentOrg();
    if (!org) return { ok: false, error: "No active organization." };
    orgId = org.id;
    actorUserId = (await getCurrentUser())?.id ?? null;
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "Something went wrong") };
  }

  try {
    // Each import is a model call that costs money. A limiter outage must not block setup.
    const allowed = await hitRateLimit(`profile_import:${orgId}`, 5, 3600).catch((err) => {
      Sentry.captureException(err);
      return true;
    });
    if (!allowed) throw new ImportError("rate_limited");

    const crawl = await crawlSite(url);
    const imported = await extractProfile(crawl);
    if (Object.keys(imported).length === 0) throw new ImportError("empty");

    await recordAudit({
      orgId,
      actorUserId,
      action: "workspace.profile_imported",
      target: new URL(crawl.pages[0]?.url ?? "https://unknown.invalid").hostname,
    });
    return { ok: true, imported };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, error: importMessage(error.code) };
    Sentry.captureException(error);
    return { ok: false, error: importMessage("extract_failed") };
  }
}
