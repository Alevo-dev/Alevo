"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/field";
import { SecretField } from "@/components/workspace/secret-field";
import { keyField } from "@/lib/secrets-registry";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveCalcom, type CalcomState } from "./actions";
import { SavedKeys } from "./integrations-ui";

const INITIAL: CalcomState = {};
const NO_SECRETS = { calcom_api_key: "", calcom_webhook_secret: "" };

type Props = { eventTypeId: string; apiKeySet: boolean; webhookSecretSet: boolean; canModify: boolean };

/**
 * Everything Cal.com needs to be "connected", in one place: the event type the
 * agent books (a profile field), the API key and the webhook secret (secrets).
 * One Save + Cancel, shown once something changed.
 */
export function CalcomForm({ eventTypeId, apiKeySet, webhookSecretSet, canModify }: Props) {
  const [typeId, setTypeId] = useState(eventTypeId);
  const [secrets, setSecrets] = useState(NO_SECRETS);
  const [state, action, pending] = useActionState(
    async (prev: CalcomState, formData: FormData) => {
      const next = await saveCalcom(prev, formData);
      if (next.ok) setSecrets(NO_SECRETS);
      return next;
    },
    INITIAL,
  );
  useActionToast(state, "Cal.com saved.");

  const savedTypeId = state.values?.calcomEventTypeId ?? eventTypeId;
  const dirty = typeId.trim() !== savedTypeId.trim() || Object.values(secrets).some((v) => v.trim() !== "");

  return (
    <div className="space-y-6">
      <form action={action} noValidate className="space-y-5">
        <div className="space-y-2">
          <div>
            <label htmlFor="calcomEventTypeId" className="text-sm font-semibold text-ink">
              Event type ID
            </label>
            <p className="mt-1 text-label text-ink-muted">The numeric ID of the Cal.com event type the agent books. Cal.com&apos;s own availability rules apply.</p>
          </div>
          <Input
            id="calcomEventTypeId"
            name="calcomEventTypeId"
            inputMode="numeric"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            invalid={!!state.errors?.calcomEventTypeId}
            disabled={!canModify}
            placeholder="123456"
            className="font-mono"
          />
          <FieldError>{state.errors?.calcomEventTypeId}</FieldError>
        </div>

        <SecretField
          field={keyField("calcom_api_key", apiKeySet)}
          value={secrets.calcom_api_key}
          error={state.errors?.calcom_api_key}
          canReveal={canModify}
          canModify={canModify}
          onChange={(next) => setSecrets((s) => ({ ...s, calcom_api_key: next }))}
        />
        <SecretField
          field={keyField("calcom_webhook_secret", webhookSecretSet)}
          value={secrets.calcom_webhook_secret}
          error={state.errors?.calcom_webhook_secret}
          canReveal={canModify}
          canModify={canModify}
          onChange={(next) => setSecrets((s) => ({ ...s, calcom_webhook_secret: next }))}
        />

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        {canModify && dirty && (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setTypeId(savedTypeId);
                setSecrets(NO_SECRETS);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </div>
        )}
      </form>

      <SavedKeys
        canModify={canModify}
        fields={[keyField("calcom_api_key", apiKeySet), keyField("calcom_webhook_secret", webhookSecretSet)].filter((f) => f.isSet)}
      />
    </div>
  );
}
