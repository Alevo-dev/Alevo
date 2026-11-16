"use client";

import { useActionState, useRef, useState } from "react";
import { Notice } from "@alevo/ui/notice";
import { SaveBar } from "@alevo/ui/save-bar";
import { Switch } from "@alevo/ui/switch";
import { LeaveDialog, useLeaveGuard, useSaveAndLeave } from "@alevo/ui/unsaved-changes";
import { saveFastCadence, type SettingsState } from "./actions";

const INITIAL: SettingsState = {};

/**
 * The testing switch: fast cadence on or off. Save and Discard are the page's bottom bar, shown once it differs from
 * what is saved. The agent reads the saved value within about 15 seconds; a follow-up already waiting keeps its old timing.
 */
export function FastCadenceForm({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, action, pending] = useActionState(
    async (prev: SettingsState, formData: FormData) => {
      const next = await saveFastCadence(prev, formData);
      if (next.ok) setSaved(formData.get("fast") === "on");
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
          <label htmlFor="fast" className="text-sm font-semibold text-ink">
            Fast cadence
          </label>
          <p className="mt-1 text-label text-ink-muted">
            Runs the follow-up loop in seconds so it can be tested without waiting days. It applies to every workspace: leave it off in production.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <span aria-hidden="true" className="min-w-5 text-[13px] font-[550] text-ink">
            {on ? "On" : "Off"}
          </span>
          <Switch id="fast" name="fast" checked={on} onChange={(e) => setOn(e.target.checked)} aria-label="Fast cadence" />
        </span>
      </div>

      <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-6 gap-y-1.5 border-t border-hairline pt-4 text-[13.5px]">
        <dt className="text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">What it changes</dt>
        <dd className="text-right text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">Normal</dd>
        <dd className="text-right text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">Fast</dd>
        <dt className="text-ink">Follow-up nudges to a quiet lead</dt>
        <dd className="text-right font-mono text-ink-muted">1d, 3d, 3d</dd>
        <dd className="text-right font-mono text-ink">20s, 30s, 40s</dd>
        <dt className="text-ink">Alert when a message gets no reply</dt>
        <dd className="text-right font-mono text-ink-muted">5m</dd>
        <dd className="text-right font-mono text-ink">30s</dd>
      </dl>

      {state.ok && !dirty && <Notice tone="success">{saved ? "Fast cadence is on. The agent picks it up within about 15 seconds." : "Fast cadence is off."}</Notice>}
      <SaveBar visible={dirty} pending={pending} error={state.error} onDiscard={() => setOn(saved)} />
      <LeaveDialog open={guard.pendingHref !== null} what="the fast cadence change" onStay={guard.stay} onLeave={guard.leave} onSave={saveAndLeave} />
    </form>
  );
}
