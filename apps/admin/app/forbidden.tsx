import type { Metadata } from "next";
import { SignOutButton } from "@clerk/nextjs";
import { buttonClass } from "@alevo/ui/button";
import { StatusAction, StatusScreen } from "@alevo/ui/status-screen";
import { APP_URL } from "@/lib/app-url";

export const metadata: Metadata = { title: "No access" };

/**
 * `forbidden()` from the (admin) layout: signed in, but not a platform admin.
 * Standalone, since the console shell never renders for them. Returns 403.
 */
export default function Forbidden() {
  return (
    <StatusScreen
      standalone
      code="403"
      kicker="No access"
      title="This console is for Alevo staff"
      description="Your account is signed in, but it isn't a platform admin. If you're looking for your workspace, it lives in the Alevo app."
      actions={
        <>
          <StatusAction href={APP_URL}>Open the Alevo app</StatusAction>
          <SignOutButton redirectUrl="/sign-in">
            <button type="button" className={buttonClass("secondary")}>
              Sign out
            </button>
          </SignOutButton>
        </>
      }
    />
  );
}
