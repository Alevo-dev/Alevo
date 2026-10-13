"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSecret, saveSecret, type ActionState } from "./actions";

const INITIAL: ActionState = {};
const inputClass =
  "min-w-72 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm";
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
};

export function SecretRow({
  secretKey,
  label,
  help,
  placeholder,
  inputType,
  isSet,
}: SecretRowProps) {
  const [saveState, saveAction, savePending] = useActionState(saveSecret, INITIAL);
  const [clearState, clearAction, clearPending] = useActionState(clearSecret, INITIAL);
  useRefreshOnSuccess(saveState);
  useRefreshOnSuccess(clearState);
  const error = saveState.error ?? clearState.error;

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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={saveAction} className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="key" value={secretKey} />
          <input
            name="value"
            type={inputType}
            autoComplete="off"
            required
            placeholder={isSet ? "Enter a new value to replace" : placeholder}
            className={inputClass}
          />
          <button type="submit" disabled={savePending} className={btnClass}>
            {isSet ? "Replace" : "Save"}
          </button>
        </form>
        {isSet && (
          <form action={clearAction}>
            <input type="hidden" name="key" value={secretKey} />
            <button type="submit" disabled={clearPending} className={btnClass}>
              Clear
            </button>
          </form>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {(saveState.ok || clearState.ok) && !error && (
        <p className="mt-2 text-sm text-muted-foreground">Saved.</p>
      )}
    </div>
  );
}
