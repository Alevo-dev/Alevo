"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the dashboard live: re-fetches the server page every `seconds` while the
 * tab is visible, and once more when it becomes visible again. Renders nothing.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
