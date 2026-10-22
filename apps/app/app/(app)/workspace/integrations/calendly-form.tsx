"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/field";
import { SecretField } from "@/components/workspace/secret-field";
import { keyField } from "@/lib/secrets-registry";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveCalendly, type CalendlyState } from "./actions";
import { SavedKeys } from "./integrations-ui";

const INITIAL: CalendlyState = {};

/**
 * Everything Calendly needs, in one place: the scheduling link the agent sends
 * (a profile field) and the webhook signing key (a secret). One Save + Cancel,
 * shown once something changed.
 */
export function CalendlyForm({ link, signingKeySet, canModify }: { link: string; signingKeySet: boolean; canModify: boolean }) {
  const [url, setUrl] = useState(link);
  const [key, setKey] = useState("");
  const [state, action, pending] = useActionState(
    async (prev: CalendlyState, formData: FormData) => {
      const next = await saveCalendly(prev, formData);
      if (next.ok) setKey("");
      return next;
    },
    INITIAL,
  );
  useActionToast(state, "Calendly saved.");

  const savedLink = state.values?.calendlyUrl ?? link;
  const dirty = url.trim() !== savedLink.trim() || key.trim() !== "";

  return (
    <div className="space-y-6">
      <form action={action} noValidate className="space-y-5">
        <div className="space-y-2">
          <div>
            <label htmlFor="calendlyUrl" className="text-sm font-semibold text-ink">
              Scheduling link
            </label>
            <p className="mt-1 text-label text-ink-muted">
              The agent sends this for leads to book themselves. Takes effect once Calendly is the booking tool under Agent.
            </p>
          </div>
          <Input
            id="calendlyUrl"
            name="calendlyUrl"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            invalid={!!state.errors?.calendlyUrl}
            disabled={!canModify}
            placeholder="https://calendly.com/your-team/30min"
          />
          <FieldError>{state.errors?.calendlyUrl}</FieldError>
        </div>

        <SecretField
          field={keyField("calendly_webhook_secret", signingKeySet)}
          value={key}
          error={state.errors?.calendly_webhook_secret}
          canReveal={canModify}
          canModify={canModify}
          onChange={setKey}
        />

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        {canModify && dirty && (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setUrl(savedLink);
                setKey("");
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

      {signingKeySet && <SavedKeys canModify={canModify} fields={[keyField("calendly_webhook_secret", true)]} />}
    </div>
  );
}
