"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { PanelRow } from "@/components/workspace/panel-row";
import { toneOptions } from "@/lib/profile/tone";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveToneAndSignoff, type ToneState } from "./actions";

const INITIAL: ToneState = {};
const FORM_ID = "tone-form";

/**
 * The page's header and the agent's tone and sign-off. Discard and Save sit in the header (the board)
 * and appear only once something changed; they submit the Tone form. `children` (the Brand colour
 * panel, which saves on its own through its dialog) follow under it.
 */
export function ToneCard({ tone, signoff, children }: { tone: string; signoff: string; children: ReactNode }) {
  const [state, action, pending] = useActionState(saveToneAndSignoff, INITIAL);
  useActionToast(state, "Tone and sign-off saved.");
  const saved = state.values && state.ok ? state.values : { tone, signoff };
  const [draft, setDraft] = useState({ tone, signoff });
  const dirty = draft.tone !== saved.tone || draft.signoff !== saved.signoff;
  const err = dirty ? state.errors : undefined;

  return (
    <>
      <PageHeader title="Brand" description="Owners and admins only">
        {dirty && (
          <>
            <Button disabled={pending} onClick={() => setDraft(saved)}>
              Discard
            </Button>
            <Button type="submit" form={FORM_ID} variant="primary" loading={pending}>
              {!pending && <Check className="size-3.5" strokeWidth={2} aria-hidden="true" />}
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </PageHeader>
      <div className="max-w-[920px] space-y-3.5">
        <Card padding="none">
          <CardHeader title="Tone and sign-off" hint="How the agent sounds and signs off." />
          <form id={FORM_ID} action={action} noValidate>
            <PanelRow label="Tone" htmlFor="tone" hint="Pick the voice closest to yours." error={err?.tone}>
              <div className="w-60 max-w-full">
                <Select
                  id="tone"
                  name="tone"
                  options={toneOptions(tone)}
                  value={draft.tone}
                  placeholder="Choose a tone"
                  onChange={(v) => setDraft((d) => ({ ...d, tone: v }))}
                />
              </div>
            </PanelRow>
            <PanelRow label="Sign off as" htmlFor="signoff" error={err?.signoff}>
              <div className="w-80 max-w-full">
                <Input
                  id="signoff"
                  name="signoff"
                  value={draft.signoff}
                  onChange={(e) => setDraft((d) => ({ ...d, signoff: e.target.value }))}
                  invalid={!!err?.signoff}
                  placeholder="Sam from Northwind IT"
                />
              </div>
            </PanelRow>
            {state.error && <p className="px-3.5 pb-3 text-label text-danger">{state.error}</p>}
          </form>
        </Card>
        {children}
      </div>
    </>
  );
}
