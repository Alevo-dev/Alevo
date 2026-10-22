"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { SecretField, type KeyField } from "@/components/workspace/secret-field";
import type { SecretKey } from "@/lib/secrets-registry";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { clearSecret, saveSecrets, sendTestSlack, type ActionState, type SaveSecretsState } from "./actions";

const INITIAL_SAVE: SaveSecretsState = {};
const INITIAL: ActionState = {};

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

/** Clear / Send test rows for keys that are already stored. */
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
