"use client";

import { useEffect } from "react";
import { Button } from "@alevo/ui/button";
import { StatusAction, StatusScreen, SUPPORT_EMAIL } from "@alevo/ui/status-screen";
import { appFontClass } from "@/components/status/app-fonts";

/** Error boundary for the marketing site: same screen as the app, site links. */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      standalone
      className={appFontClass}
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
            Back to home
          </StatusAction>
        </>
      }
      reference={error.digest ?? null}
    />
  );
}
