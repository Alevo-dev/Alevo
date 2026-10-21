import { redirect } from "next/navigation";

/**
 * Members moved into the workspace picker → "Manage" → Members tab
 * (`components/workspace/organization-dialog.tsx`). Redirect any old link.
 */
export default function MembersPage() {
  redirect("/workspace/profile");
}
