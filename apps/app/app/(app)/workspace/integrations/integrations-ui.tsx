"use client";

import { useActionState, useState } from "react";
import { Check, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { FieldError, Input } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { FIELD_PREFIX, type KeyField } from "@/lib/secrets-registry";
import type { SecretKey } from "@/lib/secrets-registry";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { useCloseOnSave } from "@/components/workspace/tool-dialog";
import { clearSecret, saveSecrets, sendTestSlack, type ActionState, type SaveSecretsState } from "./actions";

const INITIAL_SAVE: SaveSecretsState = {};
const INITIAL: ActionState = {};

/** A saved secret is never sent back to the browser, so the box shows only what kind of value it holds. */
const MASK = "••••••••••••••••••••••••••••";

type ServiceKeysFormProps = {
  fields: KeyField[];
  /** Admins and owners may save, replace, clear and test. */
  canModify: boolean;
  /** Kept for callers; secrets are never revealed. */
  canReveal?: boolean;
};

/**
 * A tool that is one URL or key plus a test (Slack, and anything like it), as in the Integrations boards: the
 * field's name with its Saved state, a masked box with Replace and Clear once saved (the input and Save while
 * it is not, or while replacing), and a Send test row under a rule. Saved values are never shown again.
 */
export function ServiceKeysForm({ fields, canModify }: ServiceKeysFormProps) {
  return (
    <div className="flex flex-col gap-5">
      {fields.map((f) => (
        <KeyRow key={f.secretKey} field={f} canModify={canModify} />
      ))}
      {fields.some((f) => f.testable && f.isSet) && canModify && <TestRow />}
    </div>
  );
}

function KeyRow({ field, canModify }: { field: KeyField; canModify: boolean }) {
  const [value, setValue] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: SaveSecretsState, formData: FormData) => {
      const next = await saveSecrets(prev, formData);
      if (next.ok) {
        setValue("");
        setReplacing(false);
      }
      return next;
    },
    INITIAL_SAVE,
  );
  const [clearState, clearAction, clearPending] = useActionState(clearSecret, INITIAL);
  useActionToast(state, `${field.label} saved.`);
  useCloseOnSave(state);
  useActionToast(clearState, `${field.label} cleared.`);

  const id = `secret-${field.secretKey}`;
  const showInput = canModify && (!field.isSet || replacing);
  const error = state.errors?.[field.secretKey as SecretKey];

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2.5 font-semibold text-ink">
        <label htmlFor={id}>{field.label}</label>
        {field.isSet && (
          <span className="ml-auto inline-flex items-center gap-2 text-[13px] font-[550]">
            <i className="size-[7px] rounded-full bg-success" aria-hidden="true" />
            Saved
          </span>
        )}
      </div>
      <p className="mb-2 text-[13px] leading-[19px] text-ink-muted">{field.help}</p>

      {showInput ? (
        <form action={action} noValidate className="flex items-center gap-2">
          <Input
            id={id}
            name={`${FIELD_PREFIX}${field.secretKey}`}
            type={field.inputType === "password" ? "password" : "text"}
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            invalid={!!error}
            placeholder={field.isSet ? "Paste the new value" : field.placeholder}
            className="min-w-0 flex-1 font-mono text-[13px]"
            autoFocus={replacing}
          />
          <Button type="submit" loading={pending} disabled={value.trim() === ""}>
            {!pending && <Check className="size-3.5 text-ink-muted" strokeWidth={2} aria-hidden="true" />}
            Save
          </Button>
          {field.isSet && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setReplacing(false);
                setValue("");
              }}
              className="cursor-pointer rounded-xs px-1.5 font-[550] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ds-focus-ring)]"
            >
              Cancel
            </button>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <div id={id} className={cx("flex min-h-[34px] min-w-0 flex-1 items-center rounded-xs border border-control bg-sunken px-2.5 font-mono text-[13px] text-ink-muted")} aria-label={`${field.label}: saved, hidden`}>
            <span className="truncate">{field.isSet ? MASK : "Not set"}</span>
          </div>
          {canModify && field.isSet && (
            <>
              <Button onClick={() => setReplacing(true)}>Replace</Button>
              <form action={clearAction}>
                <input type="hidden" name="key" value={field.secretKey} />
                <ConfirmSubmit
                  variant="ghost"
                  loading={clearPending}
                  icon={Trash2}
                  aria-label={`Clear ${field.label}`}
                  title={`Clear ${field.label}?`}
                  description="Anything that depends on it stops working until you save a new value."
                  confirmLabel="Clear"
                />
              </form>
            </>
          )}
        </div>
      )}
      <FieldError>{error ?? state.error}</FieldError>
      {clearState.error && <p className="mt-1 text-sm text-danger">{clearState.error}</p>}
    </div>
  );
}

/** "Send test": one message to the channel, and what came of it, under a rule. */
function TestRow() {
  const [state, action, pending] = useActionState(
    async (prev: ActionState & { at?: string }, formData: FormData) => {
      const next = await sendTestSlack(prev, formData);
      return { ...next, at: next.ok ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined };
    },
    INITIAL as ActionState & { at?: string },
  );
  return (
    <form action={action} className="flex items-center gap-3 border-t border-hairline pt-3" aria-live="polite">
      <p className="flex min-w-0 flex-1 items-center gap-2 text-ink-muted">
        {state.error ? (
          <span className="text-danger">{state.error}</span>
        ) : state.ok ? (
          <>
            <Check className="size-4 shrink-0 text-success" strokeWidth={2} aria-hidden="true" />
            <span className="text-ink">Test message delivered at {state.at}. Check your channel.</span>
          </>
        ) : (
          "Sends one test message to confirm the key works."
        )}
      </p>
      <Button type="submit" loading={pending}>
        {!pending && <Send className="size-3.5 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />}
        Send test
      </Button>
    </form>
  );
}

/** Clear / Send test rows for keys that are already stored (the Cal.com, Calendly and ConnectWise forms). */
export function SavedKeys({ fields, canModify }: { fields: KeyField[]; canModify: boolean }) {
  if (!canModify || fields.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-hairline pt-5">
      <h3 className="text-label font-semibold text-ink">Saved keys</h3>
      <ul className="divide-y divide-hairline">
        {fields.map((field) => (
          <SavedKeyRow key={field.secretKey} field={field} />
        ))}
      </ul>
    </div>
  );
}

function SavedKeyRow({ field }: { field: KeyField }) {
  const [clearState, clearAction, clearPending] = useActionState(clearSecret, INITIAL);
  const [testState, testAction, testPending] = useActionState(sendTestSlack, INITIAL);
  useActionToast(clearState, `${field.label} cleared.`);
  useActionToast(testState, "Test message sent. Check your Slack channel.", { refresh: false });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm text-ink">{field.label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {field.testable && (
          <form action={testAction}>
            <Button type="submit" size="sm" variant="ghost" loading={testPending}>
              Send test
            </Button>
          </form>
        )}
        <form action={clearAction}>
          <input type="hidden" name="key" value={field.secretKey} />
          <ConfirmSubmit
            size="sm"
            loading={clearPending}
            title={`Clear ${field.label}?`}
            description="Anything that depends on it stops working until you save a new value."
            confirmLabel="Clear secret"
          >
            Clear
          </ConfirmSubmit>
        </form>
      </div>
      {clearState.error && <p className="w-full text-sm text-danger">{clearState.error}</p>}
      {testState.error && <p className="w-full text-sm text-danger">{testState.error}</p>}
    </li>
  );
}
