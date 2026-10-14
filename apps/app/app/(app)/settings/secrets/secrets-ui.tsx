"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSecret, saveSecret, sendTestSlack, type ActionState } from "./actions";

const INITIAL: ActionState = {};
function inputClass(hasError: boolean) {
  return `w-full rounded-md border bg-background px-3 py-1.5 text-sm ${
    hasError ? "border-destructive" : "border-input"
  }`;
}
const btnClass =
  "rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50";

function useRefreshOnSuccess(state: ActionState) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
}

export type SecretRowProps = {
  secretKey: string;
  label: string;
  help: string;
  placeholder: string;
  inputType: "url" | "password";
  isSet: boolean;
  /** When set, shows a "Send test" button (Slack) once a value is saved. */
  testable?: boolean;
};

export function SecretRow({
  secretKey,
  label,
  help,
  placeholder,
  inputType,
  isSet,
  testable = false,
}: SecretRowProps) {
  const [saveState, saveAction, savePending] = useActionState(saveSecret, INITIAL);
  const [clearState, clearAction, clearPending] = useActionState(clearSecret, INITIAL);
  const [testState, testAction, testPending] = useActionState(sendTestSlack, INITIAL);
  // Hide the last save/clear result once the user starts editing again.
  const [dirty, setDirty] = useState(false);
  useRefreshOnSuccess(saveState);
  useRefreshOnSuccess(clearState);
  const valueError = dirty ? undefined : saveState.errors?.value;
  const error = dirty ? undefined : (saveState.error ?? clearState.error);
  const saved = !dirty && !error && !valueError && (saveState.ok || clearState.ok);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{label}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>
        </div>
        <span
          className={
            isSet
              ? "rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
              : "text-xs text-muted-foreground"
          }
        >
          {isSet ? "Set" : "Not set"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        <form
          action={saveAction}
          onSubmit={() => setDirty(false)}
          noValidate
          className="flex flex-1 flex-wrap items-start gap-2"
        >
          <input type="hidden" name="key" value={secretKey} />
          <div className="min-w-72 flex-1">
            <input
              name="value"
              type={inputType}
              autoComplete="off"
              defaultValue={saveState.value ?? ""}
              onChange={() => setDirty(true)}
              aria-invalid={!!valueError}
              placeholder={isSet ? "Enter a new value to replace" : placeholder}
              className={inputClass(!!valueError)}
            />
            {valueError && <p className="mt-1 text-xs text-destructive">{valueError}</p>}
          </div>
          <button type="submit" disabled={savePending} className={btnClass}>
            {isSet ? "Replace" : "Save"}
          </button>
        </form>
        {isSet && (
          <form action={clearAction} onSubmit={() => setDirty(false)}>
            <input type="hidden" name="key" value={secretKey} />
            <button type="submit" disabled={clearPending} className={btnClass}>
              Clear
            </button>
          </form>
        )}
        {testable && isSet && (
          <form action={testAction}>
            <button type="submit" disabled={testPending} className={btnClass}>
              {testPending ? "Sending…" : "Send test"}
            </button>
          </form>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {saved && <p className="mt-2 text-sm text-muted-foreground">Saved.</p>}
      {testState.error && <p className="mt-2 text-sm text-destructive">{testState.error}</p>}
      {testState.ok && (
        <p className="mt-2 text-sm text-muted-foreground">Sent — check your Slack channel.</p>
      )}
    </div>
  );
}
