"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Turns the OAuth callback's `?calendar_connected=` into a toast, then clears
 *  the query so a refresh doesn't repeat it. Errors stay inline on the page. */
export function ConnectResult({ connected }: { connected?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!connected) return;
    const name = connected === "m365" ? "Microsoft 365" : "Google";
    toast.success(`Connected your ${name} calendar. The agent will book meetings on it.`);
    router.replace("/workspace/agent");
  }, [connected, router]);
  return null;
}
