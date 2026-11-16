import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { orgProfiles } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { PageHeader } from "@/components/ui/page-header";
import { StatusStrip } from "@/components/workspace/status-strip";
import { getOrgTimezone } from "@/lib/org-timezone";
import { BusinessProfileForm } from "./profile-ui";
import type { BusinessProfileValues } from "./actions";

export const dynamic = "force-dynamic";
// The website import (crawl + one model call) runs as a server action on this page.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Profile" };

export default async function BusinessProfilePage() {
  try {
    await requireRole("admin");
  } catch (error) {
    authInterrupt(error);
  }

  const org = await getCurrentOrg();
  const tz = await getOrgTimezone();
  const [row] = org
    ? await withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1))
    : [];

  const initial: BusinessProfileValues = {
    companyName: row?.companyName ?? "",
    website: row?.website ?? "",
    businessAddress: row?.businessAddress ?? "",
    contactEmail: row?.contactEmail ?? "",
    contactPhone: row?.contactPhone ?? "",
    contactHours: row?.contactHours ?? "",
    offering: row?.offering ?? "",
    idealCustomer: row?.idealCustomer ?? "",
    qualifyingCriteria: row?.qualifyingCriteria ?? "",
    disqualifiers: row?.disqualifiers ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <StatusStrip row={row} tz={tz} />
      <BusinessProfileForm initial={initial} />
    </div>
  );
}
