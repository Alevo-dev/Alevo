"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { FieldError, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { cx } from "@/lib/cx";
import { FIELD_PREFIX, type SecretKey } from "@/lib/secrets-registry";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { clearSecret, saveSecrets, sendTestSlack, type ActionState, type SaveSecretsState } from "./actions";

const INITIAL_SAVE: SaveSecretsState = {};
const INITIAL: ActionState = {};

export type KeyField = {
  secretKey: SecretKey;
  label: string;
  help: string;
  placeholder: string;
  inputType: "url" | "password";
  isSet: boolean;
  /** Shows a "Send test" action once saved (Slack). */
  testable: boolean;
};

type ServiceKeysFormProps = {
  fields: KeyField[];
  /** Admins and owners may reveal what they type. */
  canReveal: boolean;
  /** Admins and owners may save and clear. */
  canModify: boolean;
};

/**
 * All of one service's keys in a single form. One Save and a Cancel beside it,
 * shown only once a field has something typed in. Saved keys are cleared or
 * tested in their own rows below, since those actions can't sit inside the form.
 */
export function ServiceKeysForm({ fields, canReveal, canModify }: ServiceKeysFormProps) {
  const [values, setValues] = useState<Partial<Record<SecretKey, string>>>({});
  // A successful save empties the fields, which hides the buttons again.
  const [state, action, pending] = useActionState(
    async (prev: SaveSecretsState, formData: FormData) => {
      const next = await saveSecrets(prev, formData);
      if (next.ok) setValues({});
      return next;
    },
    INITIAL_SAVE,
  );
  useActionToast(state, "Keys saved.");

  const dirty = Object.values(values).some((v) => (v ?? "").trim() !== "");

  return (
    <div className="space-y-6">
      <form action={action} noValidate className="space-y-5">
        {fields.map((field) => (
          <SecretField
            key={field.secretKey}
            field={field}
            value={values[field.secretKey] ?? ""}
            error={state.errors?.[field.secretKey]}
            canReveal={canReveal}
            canModify={canModify}
            onChange={(next) => setValues((prev) => ({ ...prev, [field.secretKey]: next }))}
          />
        ))}

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        {canModify && dirty && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setValues({})}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </div>
        )}
      </form>

      <SavedKeys fields={fields.filter((f) => f.isSet)} canModify={canModify} />
    </div>
  );
}

function SecretField({
  field,
  value,
  error,
  canReveal,
  canModify,
  onChange,
}: {
  field: KeyField;
  value: string;
  error?: string;
  canReveal: boolean;
  canModify: boolean;
  onChange: (next: string) => void;
}) {
  const [showValue, setShowValue] = useState(false);
  const id = `secret-${field.secretKey}`;
  const isPassword = field.inputType === "password";

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={id} className="text-sm font-semibold text-ink">
            {field.label}
          </label>
          <p className="mt-1 text-label text-ink-muted">{field.help}</p>
        </div>
        <Pill tone={field.isSet ? "success" : "muted"}>{field.isSet ? "Set" : "Not set"}</Pill>
      </div>
      <div className="relative">
        <Input
          id={id}
          name={`${FIELD_PREFIX}${field.secretKey}`}
          type={isPassword && !showValue ? "password" : "text"}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={!!error}
          disabled={!canModify}
          placeholder={field.isSet ? "Enter a new value to replace" : field.placeholder}
          className={cx("font-mono text-label", isPassword && canReveal && "pr-11")}
        />
        {isPassword && canReveal && (
          <button
            type="button"
            onClick={() => setShowValue((s) => !s)}
            aria-label={showValue ? "Hide value" : "Show value"}
            aria-pressed={showValue}
            className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:text-ink"
          >
            {showValue ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
          </button>
        )}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function SavedKeys({ fields, canModify }: { fields: KeyField[]; canModify: boolean }) {
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
