"use client";

import { useActionState, useRef, useState } from "react";
import { Notice } from "@alevo/ui/notice";
import { SaveBar } from "@alevo/ui/save-bar";
import { Switch } from "@alevo/ui/switch";
import { LeaveDialog, useLeaveGuard, useSaveAndLeave } from "@alevo/ui/unsaved-changes";
import { saveWebChatModel, type SettingsState } from "./actions";

const INITIAL: SettingsState = {};

/**
 * Web chat: Claude (off) or ChatGPT (on). Save and Discard are the page's bottom bar, shown once it differs from what
 * is saved. The agent reads the saved value within about 15 seconds; a reply already being written keeps its model.
 */
export function ChatModelForm({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, action, pending] = useActionState(
    async (prev: SettingsState, formData: FormData) => {
      const next = await saveWebChatModel(prev, formData);
      if (next.ok) setSaved(formData.get("chatgpt") === "on");
      return next;
    },
    INITIAL,
  );
  const dirty = on !== saved;
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useLeaveGuard(dirty);
  const saveAndLeave = useSaveAndLeave(guard, formRef, state);

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor="chatgpt" className="text-sm font-semibold text-ink">
            Answer web chats with ChatGPT
          </label>
          <p className="mt-1 text-label text-ink-muted">
            Uses OpenAI&apos;s gpt-6-luna instead of Claude for the website chat. If ChatGPT fails on a message, that reply is written by Claude, so a visitor is never left waiting. It needs the OPENAI_API_KEY setting on the app.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <span aria-hidden="true" className="min-w-14 text-right text-[13px] font-[550] text-ink">
            {on ? "ChatGPT" : "Claude"}
          </span>
          <Switch id="chatgpt" name="chatgpt" checked={on} onChange={(e) => setOn(e.target.checked)} aria-label="Answer web chats with ChatGPT" />
        </span>
      </div>

      {state.ok && !dirty && <Notice tone="success">{saved ? "Web chats are answered by ChatGPT. The agent picks it up within about 15 seconds." : "Web chats are answered by Claude."}</Notice>}
      <SaveBar visible={dirty} pending={pending} error={state.error} onDiscard={() => setOn(saved)} />
      <LeaveDialog open={guard.pendingHref !== null} what="the web chat model change" onStay={guard.stay} onLeave={guard.leave} onSave={saveAndLeave} />
    </form>
  );
}
