"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { StatusAction, StatusScreen, SUPPORT_EMAIL } from "@/components/status-screen";

/**
 * Error boundary for routes outside the app shell (auth screens, the public
 * lead form). Draws its own canvas; the root layout (fonts, theme) is still
 * around it. The in-shell boundary is `(app)/error.tsx`.
 */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <StatusScreen
      standalone
      code="500"
      kicker="Something broke"
      title="This page didn't load"
      description={
        <>
          Try again in a moment. If it keeps happening, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the reference below.
        </>
      }
      actions={
        <>
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
          <StatusAction href="/" variant="secondary">
            Go to Alevo
          </StatusAction>
        </>
      }
      reference={error.digest ?? null}
    />
  );
}
