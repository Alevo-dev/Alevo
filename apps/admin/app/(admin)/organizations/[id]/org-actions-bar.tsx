import { ExternalLink } from "lucide-react";
import { buttonClass } from "@alevo/ui/button";
import { joinAsSupport, leaveWorkspace } from "../actions";
import { ActionForm } from "./action-form";
import { openInApp } from "./setup-card";

/** Open in app (needs a membership), and Join as support / Leave workspace. */
export function OrgActionsBar({ orgId, clerkOrgId, member }: { orgId: string; clerkOrgId: string; member: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {member ? (
        <>
          <a href={openInApp(clerkOrgId, "/dashboard")} className={buttonClass("primary", "md", "no-underline")}>
            Open in app
            <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </a>
          <ActionForm
            action={leaveWorkspace}
            fields={{ orgId }}
            variant="ghost"
            size="md"
            confirm={{ title: "Leave this workspace?", description: "You stop seeing it in the app. You can join again from this page.", confirmLabel: "Leave workspace" }}
          >
            Leave workspace
          </ActionForm>
        </>
      ) : (
        <ActionForm action={joinAsSupport} fields={{ orgId }} variant="primary" size="md">
          Join as support
        </ActionForm>
      )}
    </div>
  );
}
