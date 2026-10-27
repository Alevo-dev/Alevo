"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Turns the OAuth callback's `?calendar_connected=` into a toast (with a link
 *  straight to Agent → Booking), then clears the query so a refresh doesn't
 *  repeat it. Errors stay inline on the page. */
export function ConnectResult({ connected }: { connected?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!connected) return;
    const name = connected === "m365" ? "Microsoft 365" : "Google";
    toast.success(
      <span>
        Connected your {name} calendar. Turn booking on under{" "}
        <Link href="/workspace/agent" className="font-semibold underline underline-offset-2">
          Agent
        </Link>{" "}
        to use it.
      </span>,
    );
    router.replace("/workspace/integrations");
  }, [connected, router]);
  return null;
}
