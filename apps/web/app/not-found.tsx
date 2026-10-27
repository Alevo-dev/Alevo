import type { Metadata } from "next";
import { StatusAction, StatusScreen } from "@alevo/ui/status-screen";
import { appFontClass } from "@/components/status/app-fonts";
import { appLinks } from "@/lib/site";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** The same status screen as the product app, with the site's own ways out. */
export default function NotFound() {
  return (
    <StatusScreen
      standalone
      className={appFontClass}
      code="404"
      kicker="Page not found"
      title="This page isn't here"
      description="The link may be old or mistyped. Everything about Alevo is a click away from the home page, and the app is where your workspace lives."
      actions={
        <>
          <StatusAction href="/">Back to home</StatusAction>
          <StatusAction href="/contact" variant="secondary">
            Contact us
          </StatusAction>
          <StatusAction href={appLinks.login} variant="secondary">
            Sign in to the app
          </StatusAction>
        </>
      }
    />
  );
}
