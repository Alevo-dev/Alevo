"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * While `active`, poll the server for new messages — the Qualifier replies
 * asynchronously (Claude + Inngest), so the reply lands a few seconds after the
 * contact's message. Bounded by `maxAttempts` so it never polls forever (e.g.
 * when the Qualifier is disabled and no reply is coming). Key this component by
 * the last message id so each new inbound message resets the attempt budget.
 */
export function AutoRefresh({
  active,
  intervalMs = 2500,
  maxAttempts = 8,
}: {
  active: boolean;
  intervalMs?: number;
  maxAttempts?: number;
}) {
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (!active) return;
    attempts.current = 0;
    const id = setInterval(() => {
      attempts.current += 1;
      if (attempts.current > maxAttempts) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, maxAttempts, router]);

  return null;
}
