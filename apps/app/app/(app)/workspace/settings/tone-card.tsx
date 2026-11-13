"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { toneOptions } from "@/lib/profile/tone";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveToneAndSignoff, type ToneState } from "./actions";

const INITIAL: ToneState = {};

/** The agent's tone and sign-off: one form, Save and Cancel appear only once something changed. */
export function ToneCard({ tone, signoff }: { tone: string; signoff: string }) {
  const [state, action, pending] = useActionState(saveToneAndSignoff, INITIAL);
  useActionToast(state, "Tone and sign-off saved.");
  const saved = state.values && state.ok ? state.values : { tone, signoff };
  const [draft, setDraft] = useState({ tone, signoff });
  const dirty = draft.tone !== saved.tone || draft.signoff !== saved.signoff;
  const err = dirty ? state.errors : undefined;

  return (
    <Card>
      <CardHeader title="Tone and sign-off" hint="How the agent sounds and signs off." />
      <form action={action} noValidate className="mt-6">
        <SettingRow label="Tone" htmlFor="tone" hint="Pick the voice closest to yours." error={err?.tone}>
          <Select
            id="tone"
            name="tone"
            options={toneOptions(tone)}
            value={draft.tone}
            placeholder="Choose a tone"
            onChange={(v) => setDraft((d) => ({ ...d, tone: v }))}
          />
        </SettingRow>
        <SettingRow label="Sign off as" htmlFor="signoff" error={err?.signoff}>
          <Input
            id="signoff"
            name="signoff"
            value={draft.signoff}
            onChange={(e) => setDraft((d) => ({ ...d, signoff: e.target.value }))}
            invalid={!!err?.signoff}
            placeholder="Sam from Northwind IT"
          />
        </SettingRow>
        {state.error && <p className="mt-4 text-sm text-danger">{state.error}</p>}
        {dirty && (
          <div className="mt-6 flex gap-2">
            <Button type="submit" size="sm" variant="primary" loading={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setDraft(saved)}>
              Cancel
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
