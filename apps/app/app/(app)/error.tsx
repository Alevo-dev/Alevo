"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { StatusAction, StatusScreen, SUPPORT_EMAIL } from "@/components/status-screen";

/**
 * Error boundary for every app page. The shell (sidebar, top bar) stays put;
 * only the content column shows this. The agent, webhooks and Inngest keep
 * running — this is a screen that failed to load, not an outage, and the copy
 * says so. The digest is what support can match to the server log.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <StatusScreen
      code="500"
      kicker="Something broke"
      title="This screen didn't load"
      description={
        <>
          The agent is still answering leads; only this page failed. Try again, and if it keeps happening, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the reference below.
        </>
      }
      actions={
        <>
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
          <StatusAction href="/dashboard" variant="secondary">
            Back to dashboard
          </StatusAction>
        </>
      }
      reference={error.digest ?? null}
    />
  );
}
