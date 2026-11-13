import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { orgProfiles } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { BrandColour } from "./brand-colour";
import { ToneCard } from "./tone-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Workspace settings" };

/** How the workspace presents itself: the agent's tone and sign-off, and the brand colours. Admins and owners only. */
export default async function WorkspaceSettingsPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    authInterrupt(error);
  }

  const org = await getCurrentOrg();
  const [row] = org
    ? await withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1))
    : [];

  return (
    <div className="space-y-6">
      <ToneCard tone={row?.tone ?? ""} signoff={row?.signoff ?? ""} />
      {/* This page is admin-only, so the brand card can always edit. */}
      <BrandColour accent={row?.brandColor ?? ""} textColor={row?.brandTextColor ?? ""} canModify />
    </div>
  );
}
