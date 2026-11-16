"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
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
      className="flex flex-col gap-2 border-t border-hairline bg-sunken px-3.5 py-3"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <Label htmlFor="reply-body">Reply as contact (testing)</Label>
      <Textarea
        id="reply-body"
        name="body"
        rows={2}
        defaultValue={state.value ?? ""}
        invalid={!!bodyError}
        placeholder="Write a message as the contact. It fires the same event as a real reply."
      />
      <FieldError>{bodyError}</FieldError>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          {!pending && <Send className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />}
          {pending ? "Sending…" : "Send as contact"}
        </Button>
      </div>
    </form>
  );
}
