"use client";

import { useEffect } from "react";
import { Button } from "@alevo/ui/button";
import { StatusAction, StatusScreen, SUPPORT_EMAIL } from "@alevo/ui/status-screen";

/** Error boundary for the console (the admin app has no Sentry yet: logs to the console). */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      standalone
      code="500"
      kicker="Something broke"
      title="This screen didn't load"
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
          <StatusAction href="/dashboard" variant="secondary">
            Back to the console
          </StatusAction>
        </>
      }
      reference={error.digest ?? null}
    />
  );
}
