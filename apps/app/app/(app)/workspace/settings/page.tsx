import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { orgProfiles } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { BrandForm } from "./tone-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Brand" };

/** How the workspace presents itself: the agent's tone and sign-off, and the brand colours. Admins and owners only. */
export default async function WorkspaceBrandPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    authInterrupt(error);
  }

  const org = await getCurrentOrg();
  const [row] = org
    ? await withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1))
    : [];

  return <BrandForm tone={row?.tone ?? ""} signoff={row?.signoff ?? ""} accent={row?.brandColor ?? ""} textColor={row?.brandTextColor ?? ""} />;
}
