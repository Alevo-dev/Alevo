"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { replyAsContact, type ReplyState } from "./actions";

const INITIAL: ReplyState = {};

/**
 * Dev/test affordance: send a message as the contact to drive the Qualifier.
 * Stands in for inbound email/SMS until those channels land.
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
  // Transient confirmation — the thread's AutoRefresh shows the real reply, so
  // this note self-dismisses instead of lingering as "replying…" forever.
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    router.refresh();
    // Deferred (not a synchronous setState in the effect body): show the note,
    // then self-dismiss so it doesn't linger as "replying…" forever.
    const show = setTimeout(() => setShowNote(true), 0);
    const hide = setTimeout(() => setShowNote(false), 6000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [state, router]);

  const bodyError = state.errors?.body;

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="rounded-lg border border-dashed border-border p-3"
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <label htmlFor="reply-body" className="text-xs font-medium text-muted-foreground">
        Reply as the contact (test)
      </label>
      <textarea
        id="reply-body"
        name="body"
        rows={2}
        defaultValue={state.value ?? ""}
        aria-invalid={!!bodyError}
        placeholder="Type what the contact would say…"
        className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm ${
          bodyError ? "border-destructive" : "border-input"
        }`}
      />
      {bodyError && <p className="mt-1 text-xs text-destructive">{bodyError}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send as contact"}
        </button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {showNote && !state.error && (
          <p className="text-sm text-muted-foreground">
            {qualifierEnabled ? "Sent — the Qualifier is replying…" : "Sent — Qualifier is off."}
          </p>
        )}
      </div>
    </form>
  );
}
