"use client";

import { useEffect, useRef, useState } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

/**
 * Make `clerkOrgId` the active workspace, then do a full navigation to `to` so
 * every server component re-reads the new org (same as the workspace switcher).
 */
export function OpenOrg({ clerkOrgId, to }: { clerkOrgId: string; to: string }) {
  const { isLoaded, setActive } = useOrganizationList();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    setActive({ organization: clerkOrgId })
      .then(() => window.location.assign(to))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Couldn't open the workspace."));
  }, [isLoaded, setActive, clerkOrgId, to]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm text-center">
        {error ? (
          <Notice tone="danger">{error}</Notice>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-muted">
            <Spinner /> Opening workspace…
          </p>
        )}
      </Card>
    </main>
  );
}
