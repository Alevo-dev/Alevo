"use client";

import { useActionState } from "react";
import type { DeclineKey } from "@alevo/db";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { declineSetupItem, type SetupState } from "./setup-actions";

const INITIAL: SetupState = {};

/** "Not using this" / "Using this after all" for a declinable checklist item. */
export function DeclineButton({ item, declined }: { item: DeclineKey; declined: boolean }) {
  const [state, action, pending] = useActionState(declineSetupItem, INITIAL);
  useActionToast(state, declined ? "Back on the list." : "Marked as not used.");
  return (
    <form action={action}>
      <input type="hidden" name="key" value={item} />
      <input type="hidden" name="value" value={String(!declined)} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {declined ? "Using this after all" : "Not using this"}
      </Button>
    </form>
  );
}
