"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JUMP } from "@/lib/jump";

/** The callback's short error codes, as sentences. Anything else is the vendor's own message. */
const ERROR_TEXT: Record<string, string> = {
  forbidden: "Only an admin can connect a calendar.",
  no_org: "No workspace is selected.",
  access_denied: "You cancelled the sign-in before granting access.",
  missing_params: "The sign-in came back incomplete. Try again.",
  bad_state: "The sign-in link had expired. Try again.",
  no_account_email: "The account did not share an email address, which the calendar needs.",
  connect_failed: "Something went wrong while saving the connection.",
};

/**
 * Turns the OAuth callback's `?calendar_connected=` / `?calendar_error=` into a
 * toast, then clears the query so a refresh doesn't repeat it and the error
 * never sits in the address bar. Success is the usual 4s toast (with a link
 * straight to Agent → Booking); an error stays on screen until the user closes it.
 */
export function ConnectResult({ connected, error }: { connected?: string; error?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!connected && !error) return;
    if (connected) {
      const name = connected === "m365" ? "Microsoft 365" : "Google";
      toast.success(
        <span>
          Connected your {name} calendar. Turn booking on under{" "}
          <Link href={JUMP.agentBooking} className="font-semibold underline underline-offset-2">
            Agent
          </Link>{" "}
          to use it.
        </span>,
      );
    }
    if (error) {
      toast.error("Couldn't connect your calendar", {
        description: ERROR_TEXT[error] ?? error,
        duration: Infinity,
      });
    }
    router.replace("/workspace/integrations");
  }, [connected, error, router]);
  return null;
}
