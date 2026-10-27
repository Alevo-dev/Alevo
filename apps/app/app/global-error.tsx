"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { StatusAction, StatusScreen, SUPPORT_EMAIL } from "@/components/status-screen";
import { themeBootScript } from "@alevo/ui/theme-script";
import "./globals.css";

/**
 * Last resort: the root layout itself failed, so this replaces the whole
 * document. Nothing from the layout survives (fonts, theme provider), so it
 * loads the global styles itself and reads the saved theme the same way the
 * provider does (next-themes' `theme` key, else the OS), before first paint.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <title>Something broke | Alevo</title>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript("alevo-theme-v2") }} />
      </head>
      <body className="min-h-full bg-canvas text-ink">
        <StatusScreen
          standalone
          code="500"
          kicker="Something broke"
          title="Alevo didn't load"
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
              <StatusAction href="/" variant="secondary">
                Go to Alevo
              </StatusAction>
            </>
          }
          reference={error.digest ?? null}
        />
      </body>
    </html>
  );
}
