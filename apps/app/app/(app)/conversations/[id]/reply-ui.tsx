"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/field";
import { replyAsContact, type ReplyState } from "./actions";

const INITIAL: ReplyState = {};

/**
 * Dev/test affordance: send a message as the contact to drive the Qualifier.
 * Stands in for inbound email/SMS when those channels aren't wired up.
 */
export function ReplyAsContact({
  conversationId,
  qualifierEnabled,
}: {
  conversationId: string;
  qualifierEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(replyAsContact, INITIAL);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // The thread's AutoRefresh shows the real reply; the toast just confirms the send.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    router.refresh();
    toast.success(qualifierEnabled ? "Sent. The agent is replying." : "Sent. The agent is off.");
  }, [state, router, qualifierEnabled]);

  const bodyError = state.errors?.body;

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="mt-auto flex flex-col gap-3 border-t border-hairline pt-6"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <Label htmlFor="reply-body">Reply as the contact (test)</Label>
      <Textarea
        id="reply-body"
        name="body"
        rows={3}
        defaultValue={state.value ?? ""}
        invalid={!!bodyError}
        placeholder="Type what the contact would say. It's recorded as an inbound message."
      />
      <FieldError>{bodyError}</FieldError>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sending…" : "Send as contact"}
        </Button>
      </div>
    </form>
  );
}
