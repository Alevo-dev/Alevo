import type { Metadata } from "next";
import { StatusAction, StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = { title: "No access" };

/**
 * `forbidden()` inside the shell: signed in, in the workspace, but the role is
 * too low (rule 4: roles live in our DB; `requireRole` throws, `authInterrupt`
 * routes here). Returns a 403.
 */
export default function AppForbidden() {
  return (
    <StatusScreen
      code="403"
      kicker="No access"
      title="This part is for owners and admins"
      description="Your role in this workspace doesn't cover it. Ask an owner or admin to change your role, or to make the change for you."
      actions={
        <>
          <StatusAction href="/dashboard">Back to dashboard</StatusAction>
          <StatusAction href="/workspace/members" variant="secondary">
            See who can help
          </StatusAction>
        </>
      }
    />
  );
}
