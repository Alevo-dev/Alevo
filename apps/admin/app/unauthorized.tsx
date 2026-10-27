import type { Metadata } from "next";
import { StatusAction, StatusScreen } from "@alevo/ui/status-screen";

export const metadata: Metadata = { title: "Sign in to continue" };

/** `unauthorized()` from the (admin) layout: no session, or no mirrored user yet. Returns 401. */
export default function Unauthorized() {
  return (
    <StatusScreen
      standalone
      code="401"
      kicker="Signed out"
      title="Sign in to continue"
      description="Your session ended, or this account hasn't been seen by Alevo yet. Sign in with your staff account to open the console."
      actions={<StatusAction href="/sign-in">Sign in</StatusAction>}
    />
  );
}
