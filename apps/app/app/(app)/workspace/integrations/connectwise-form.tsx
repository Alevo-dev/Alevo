"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SecretField } from "@/components/workspace/secret-field";
import { keyField } from "@/lib/secrets-registry";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveConnectWise, testConnectWise, type ConnectWiseState, type ConnectWiseTestState } from "./actions";
import { SavedKeys } from "./integrations-ui";

const INITIAL: ConnectWiseState = {};
const NO_SECRETS = { connectwise_public_key: "", connectwise_private_key: "" };

type Props = {
  site: string;
  companyId: string;
  member: string;
  publicKeySet: boolean;
  privateKeySet: boolean;
  connected: boolean;
  canModify: boolean;
};

const FIELDS = [
  {
    name: "connectwiseSite",
    label: "API site",
    help: "The Manage API host for your region or sandbox, e.g. api-na.myconnectwise.net or api-staging.connectwisedev.com.",
    placeholder: "api-na.myconnectwise.net",
  },
  {
    name: "connectwiseCompanyId",
    label: "Company ID",
    help: "The company id you log in to Manage with.",
    placeholder: "mymsp",
  },
  {
    name: "connectwiseMember",
    label: "API member identifier",
    help: "Activities and opportunities are assigned to this member (System → Members → API Members).",
    placeholder: "alevo",
  },
] as const;

type FieldName = (typeof FIELDS)[number]["name"];

/**
 * Everything ConnectWise needs to be "connected", in one place: the site,
 * company ID and member (profile fields) plus the public / private keys
 * (secrets). One Save + Cancel, shown once something changed; a Test
 * connection button once it is complete.
 */
export function ConnectWiseForm({ site, companyId, member, publicKeySet, privateKeySet, connected, canModify }: Props) {
  const saved = { connectwiseSite: site, connectwiseCompanyId: companyId, connectwiseMember: member };
  const [values, setValues] = useState<Record<FieldName, string>>(saved);
  const [secrets, setSecrets] = useState(NO_SECRETS);
  const [state, action, pending] = useActionState(
    async (prev: ConnectWiseState, formData: FormData) => {
      const next = await saveConnectWise(prev, formData);
      if (next.ok) setSecrets(NO_SECRETS);
      return next;
    },
    INITIAL,
  );
  useActionToast(state, "ConnectWise saved.");
  const [test, testAction, testing] = useActionState<ConnectWiseTestState, FormData>(testConnectWise, {});

  const current = state.values ?? saved;
  const dirty =
    FIELDS.some((f) => values[f.name].trim() !== current[f.name].trim()) || Object.values(secrets).some((v) => v.trim() !== "");

  return (
    <div className="space-y-6">
      {connected ? (
        <Notice tone="success">Connected. Leads that are handed off or book a meeting are written to Manage.</Notice>
      ) : (
        <Notice>Fill in every field and both keys. Until then nothing is written back.</Notice>
      )}

      <form action={action} noValidate className="space-y-5">
        {FIELDS.map((f) => (
          <div key={f.name} className="space-y-2">
            <div>
              <label htmlFor={f.name} className="text-sm font-semibold text-ink">
                {f.label}
              </label>
              <p className="mt-1 text-label text-ink-muted">{f.help}</p>
            </div>
            <Input
              id={f.name}
              name={f.name}
              value={values[f.name]}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              invalid={!!state.errors?.[f.name]}
              disabled={!canModify}
              placeholder={f.placeholder}
              className="font-mono"
              autoComplete="off"
            />
            <FieldError>{state.errors?.[f.name]}</FieldError>
          </div>
        ))}

        <SecretField
          field={keyField("connectwise_public_key", publicKeySet)}
          value={secrets.connectwise_public_key}
          error={state.errors?.connectwise_public_key}
          canReveal={canModify}
          canModify={canModify}
          onChange={(next) => setSecrets((s) => ({ ...s, connectwise_public_key: next }))}
        />
        <SecretField
          field={keyField("connectwise_private_key", privateKeySet)}
          value={secrets.connectwise_private_key}
          error={state.errors?.connectwise_private_key}
          canReveal={canModify}
          canModify={canModify}
          onChange={(next) => setSecrets((s) => ({ ...s, connectwise_private_key: next }))}
        />

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        {canModify && dirty && (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setValues(current);
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

      {canModify && connected && !dirty && (
        <form action={testAction} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">Round-trip to your Manage instance with the saved keys.</p>
            <Button type="submit" variant="secondary" size="sm" loading={testing}>
              Test connection
            </Button>
          </div>
          {test.ok && test.detail && <Notice tone="success">{test.detail}</Notice>}
          {test.error && <Notice tone="danger">{test.error}</Notice>}
        </form>
      )}

      <SavedKeys
        canModify={canModify}
        fields={[keyField("connectwise_public_key", publicKeySet), keyField("connectwise_private_key", privateKeySet)].filter((f) => f.isSet)}
      />
    </div>
  );
}
