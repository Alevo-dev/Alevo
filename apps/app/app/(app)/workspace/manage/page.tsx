import type { Metadata } from "next";
import { getCurrentRole } from "@alevo/auth";
import { GeneralTab } from "@/components/workspace/general-tab";
import { MembersTab } from "@/components/workspace/members-tab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Manage workspace" };

/** The workspace itself: name, logo, id and members. Everyone sees it; only admins and owners change it. */
export default async function ManagePage() {
  const role = await getCurrentRole();
  const canEdit = role === "admin" || role === "owner";
  return (
    <div className="max-w-3xl space-y-6">
      {!canEdit && (
        <p className="text-sm text-ink-muted">You can see who is in this workspace. Only owners and admins can change it.</p>
      )}
      <GeneralTab canEdit={canEdit} />
      <MembersTab canEdit={canEdit} />
    </div>
  );
}
