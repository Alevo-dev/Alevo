"use client";

import { useActionState } from "react";
import type { DeclineKey } from "@alevo/db";
import { Undo2, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { declineSetupItem, type SetupState } from "./setup-actions";

const INITIAL: SetupState = {};

/** An icon button: "Not using this" (x) / "Using this after all" (undo) for a declinable checklist item. */
export function DeclineButton({ item, declined }: { item: DeclineKey; declined: boolean }) {
  const [state, action, pending] = useActionState(declineSetupItem, INITIAL);
  useActionToast(state, declined ? "Back on the list." : "Marked as not used.");
  const label = declined ? "Using this after all" : "Not using this";
  return (
    <form action={action}>
      <input type="hidden" name="key" value={item} />
      <input type="hidden" name="value" value={String(!declined)} />
      <IconButton type="submit" loading={pending} aria-label={label} title={label}>
        {declined ? <Undo2 className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
      </IconButton>
    </form>
  );
}
