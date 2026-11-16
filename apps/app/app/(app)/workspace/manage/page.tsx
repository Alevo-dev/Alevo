import type { Metadata } from "next";
import { getCurrentRole } from "@alevo/auth";
import { PageHeader } from "@/components/ui/page-header";
import { GeneralTab } from "@/components/workspace/general-tab";
import { MembersTab } from "@/components/workspace/members-tab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Manage workspace" };

/** The workspace itself: name, logo, id and members. Everyone sees it; only admins and owners change it. */
export default async function ManagePage() {
  const role = await getCurrentRole();
  const canEdit = role === "admin" || role === "owner";
  return (
    <>
      <PageHeader title="Manage" />
      <div className="max-w-[920px] space-y-5">
        <GeneralTab canEdit={canEdit} />
        <MembersTab canEdit={canEdit} />
      </div>
    </>
  );
}
