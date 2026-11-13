import { redirect } from "next/navigation";

/** Members live under Workspace → Manage (`../manage`). Redirect any old link. */
export default function MembersPage() {
  redirect("/workspace/manage");
}
