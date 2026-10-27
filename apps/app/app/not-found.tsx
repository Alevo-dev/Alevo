import type { Metadata } from "next";
import { StatusAction, StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = { title: "Page not found" };

/** Unmatched URLs outside the app shell (auth routes, the public form). Own canvas. */
export default function NotFound() {
  return (
    <StatusScreen
      standalone
      code="404"
      kicker="Page not found"
      title="This page isn't here"
      description="The link may be old or mistyped. If someone sent it to you, ask them for a fresh one."
      actions={
        <>
          <StatusAction href="/dashboard">Go to Alevo</StatusAction>
          <StatusAction href="/sign-in" variant="secondary">
            Sign in
          </StatusAction>
        </>
      }
    />
  );
}
