"use client";

import { useActionState } from "react";
import { Trash2, UserRoundCheck } from "lucide-react";
import type { ConversationStatus } from "@alevo/db";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { FieldError } from "@/components/ui/field";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { deleteConversation, handOffConversation, markClientNotFit, markNotFit, type StatusState } from "./status-actions";

const INITIAL: StatusState = {};

/**
 * The thread's own actions. Reps and above hand off or mark not a fit; admins and
 * above delete. Errors sit under the buttons (never a toast); successes toast.
 */
export function ThreadActions({ conversationId, status, canAct, canDelete }: { conversationId: string; status: ConversationStatus; canAct: boolean; canDelete: boolean }) {
  const [handOff, handOffAction, handingOff] = useActionState(handOffConversation, INITIAL);
  const [notFit, notFitAction, marking] = useActionState(markNotFit, INITIAL);
  const [del, deleteAction, deleting] = useActionState(deleteConversation, INITIAL);
  useActionToast(handOff, "Handed off. Your team has been alerted.");
  useActionToast(notFit, "Marked as not a fit.");

  const showHandOff = canAct && status !== "handed_off" && status !== "booked";
  const showNotFit = canAct && status !== "disqualified" && status !== "booked";
  if (!showHandOff && !showNotFit && !canDelete) return null;
  const error = handOff.error ?? notFit.error ?? del.error;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {showHandOff && (
          <form action={handOffAction}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <Button type="submit" size="sm" variant="secondary" loading={handingOff}>
              <UserRoundCheck className="size-[15px] text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
              Hand off to a person
            </Button>
          </form>
        )}
        {showNotFit && (
          <form action={notFitAction}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <ConfirmSubmit
              size="sm"
              variant="secondary"
              tone="primary"
              loading={marking}
              title="Mark as not a fit?"
              description="The agent stops following up on this conversation. You can still read it, and a new message from them is recorded here."
              confirmLabel="Mark as not a fit"
            >
              Mark as not a fit
            </ConfirmSubmit>
          </form>
        )}
        {canDelete && (
          <form action={deleteAction}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <ConfirmSubmit
              size="sm"
              loading={deleting}
              title="Delete this conversation?"
              description="The conversation, its messages and its call records are removed. This cannot be undone."
              confirmLabel="Delete conversation"
              cancelLabel="Keep"
            >
              <Trash2 className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
              Delete
            </ConfirmSubmit>
          </form>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Client page: every open conversation of this client becomes not a fit (the dialog says how many). */
export function ClientNotFit({ contactId, openCount }: { contactId: string; openCount: number }) {
  const [state, action, pending] = useActionState(markClientNotFit, INITIAL);
  useActionToast(state, "Marked as not a fit.");
  if (openCount === 0) return null;
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="contactId" value={contactId} />
      <ConfirmSubmit
        size="sm"
        variant="secondary"
        tone="primary"
        loading={pending}
        title="Mark this client as not a fit?"
        description={`${openCount} open ${openCount === 1 ? "conversation" : "conversations"} will be marked as not a fit, and the agent stops following up on ${openCount === 1 ? "it" : "them"}.`}
        confirmLabel="Mark as not a fit"
      >
        Mark as not a fit
      </ConfirmSubmit>
      <FieldError>{state.error}</FieldError>
    </form>
  );
}
