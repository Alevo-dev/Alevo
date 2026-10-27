import type { Metadata } from "next";
import { StatusAction, StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = { title: "Sign in to continue" };

/**
 * `unauthorized()` inside the shell: the session is gone, or the user isn't a
 * member of the active workspace (`requireRole` with no membership). Returns a
 * 401. proxy.ts normally catches signed-out visitors first, so this mostly
 * shows for a session that expired mid-visit.
 */
export default function AppUnauthorized() {
  return (
    <StatusScreen
      code="401"
      kicker="Signed out"
      title="Sign in to continue"
      description="Your session ended, or this account isn't a member of the workspace you're looking at. Sign in again and pick the right workspace."
      actions={
        <>
          <StatusAction href="/sign-in">Sign in</StatusAction>
          <StatusAction href="/onboarding/choose-organization" variant="secondary">
            Switch workspace
          </StatusAction>
        </>
      }
    />
  );
}
