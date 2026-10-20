import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { orgProfiles } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { BusinessProfileForm } from "./profile-ui";
import type { BusinessProfileValues } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Business profile" };

export default async function BusinessProfilePage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to edit the business profile.</Notice>;
    }
    throw error;
  }

  const org = await getCurrentOrg();
  const [row] = org
    ? await withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1))
    : [];

  const initial: BusinessProfileValues = {
    companyName: row?.companyName ?? "",
    offering: row?.offering ?? "",
    idealCustomer: row?.idealCustomer ?? "",
    qualifyingCriteria: row?.qualifyingCriteria ?? "",
    disqualifiers: row?.disqualifiers ?? "",
    tone: row?.tone ?? "",
    signoff: row?.signoff ?? "",
  };

  return <BusinessProfileForm initial={initial} agentOn={row?.enabled ?? false} />;
}
