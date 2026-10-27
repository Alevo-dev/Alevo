"use client";

import { useEffect } from "react";
import { Button } from "@alevo/ui/button";
import { StatusAction, StatusScreen, SUPPORT_EMAIL } from "@alevo/ui/status-screen";
import { themeBootScript } from "@alevo/ui/theme-script";
import "./globals.css";

/** The root layout itself failed: replaces the document, loads styles + theme itself. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <title>Something broke · Alevo Admin</title>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript("alevo-admin-theme") }} />
      </head>
      <body className="min-h-full bg-canvas text-ink">
        <StatusScreen
          standalone
          code="500"
          kicker="Something broke"
          title="The console didn't load"
          description={
            <>
              Something failed before the page could draw. Reload to try again; if it keeps happening, email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the reference below.
            </>
          }
          actions={
            <>
              <Button variant="primary" onClick={() => retry()}>
                Reload
              </Button>
              <StatusAction href="/dashboard" variant="secondary">
                Back to the console
              </StatusAction>
            </>
          }
          reference={error.digest ?? null}
        />
      </body>
    </html>
  );
}
