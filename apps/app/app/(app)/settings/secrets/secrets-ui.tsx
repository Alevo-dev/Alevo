"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { FieldError, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { clearSecret, saveSecret, sendTestSlack, type ActionState } from "./actions";

const INITIAL: ActionState = {};

export type SecretCardProps = {
  secretKey: string;
  label: string;
  help: string;
  placeholder: string;
  inputType: "url" | "password";
  isSet: boolean;
  /** When set, shows a "Send test" button (Slack) once a value is saved. */
  testable?: boolean;
};

/** One integration credential: status, help, and save / replace / clear / test. */
export function SecretCard({ secretKey, label, help, placeholder, inputType, isSet, testable = false }: SecretCardProps) {
  const [saveState, saveAction, savePending] = useActionState(saveSecret, INITIAL);
  const [clearState, clearAction, clearPending] = useActionState(clearSecret, INITIAL);
  const [testState, testAction, testPending] = useActionState(sendTestSlack, INITIAL);
  // Hide the last save/clear result once the user starts editing again.
  const [dirty, setDirty] = useState(false);
  useActionToast(saveState, `${label} saved.`);
  useActionToast(clearState, `${label} cleared.`);
  useActionToast(testState, "Test message sent. Check your Slack channel.", { refresh: false });
  const valueError = dirty ? undefined : saveState.errors?.value;
  const error = dirty ? undefined : (saveState.error ?? clearState.error);
  const inputId = `secret-${secretKey}`;

  return (
    <Card as="article" padding="sm" className="flex flex-col gap-4 rounded-md p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-sans text-sm font-semibold tracking-normal text-ink">{label}</h3>
          <p className="mt-1 text-label text-ink-muted">{help}</p>
        </div>
        <Pill tone={isSet ? "success" : "muted"}>{isSet ? "Set" : "Not set"}</Pill>
      </div>

      <form action={saveAction} onSubmit={() => setDirty(false)} noValidate className="flex flex-col gap-2">
        <input type="hidden" name="key" value={secretKey} />
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            name="value"
            type={inputType}
            autoComplete="off"
            defaultValue={saveState.value ?? ""}
            onChange={() => setDirty(true)}
            invalid={!!valueError}
            placeholder={isSet ? "Enter a new value to replace" : placeholder}
            className="font-mono text-label"
          />
          <Button type="submit" variant={isSet ? "secondary" : "primary"} disabled={savePending}>
            {isSet ? "Replace" : "Save"}
          </Button>
        </div>
        <FieldError>{valueError}</FieldError>
      </form>

      {isSet && (
        <div className="flex flex-wrap gap-2">
          <form action={clearAction} onSubmit={() => setDirty(false)}>
            <input type="hidden" name="key" value={secretKey} />
            <ConfirmSubmit
              size="sm"
              disabled={clearPending}
              title={`Clear ${label}?`}
              description="Anything that depends on it stops working until you save a new value."
              confirmLabel="Clear secret"
            >
              Clear
            </ConfirmSubmit>
          </form>
          {testable && (
            <form action={testAction}>
              <Button type="submit" size="sm" variant="ghost" disabled={testPending}>
                {testPending ? "Sending…" : "Send test"}
              </Button>
            </form>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {testState.error && <p className="text-sm text-danger">{testState.error}</p>}
    </Card>
  );
}
