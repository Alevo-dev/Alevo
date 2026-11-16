"use client";

import { useActionState, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { PanelRow } from "@/components/workspace/panel-row";
import { LeaveDialog, useLeaveGuard, useSaveAndLeave } from "@/components/ui/unsaved-changes";
import { SaveBar } from "@/components/workspace/save-bar";
import { normaliseHex } from "@/lib/colour";
import { toneOptions } from "@/lib/profile/tone";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { BrandColour } from "./brand-colour";
import { saveBrandPage, type BrandPageState } from "./save-all";

const INITIAL: BrandPageState = {};
const norm = (v: string) => normaliseHex(v) ?? v.trim().toLowerCase();

type Values = { tone: string; signoff: string; accent: string; textColor: string };

/**
 * The Brand page as ONE form with one Save: the agent's tone and sign-off, and the brand colours. Changing
 * any of them shows the bottom bar (Save changes / Discard), like the Agent and Profile pages.
 */
export function BrandForm(initial: Values) {
  const [state, action, pending] = useActionState(saveBrandPage, INITIAL);
  useActionToast(state, "Brand settings saved.");
  const [draft, setDraft] = useState<Values>(initial);

  // What is saved now: the first load, then whatever the last successful save returned.
  const saved: Values = state.ok && state.tone?.values && state.colour?.values ? { ...state.tone.values, ...state.colour.values } : initial;
  const dirty = draft.tone !== saved.tone || draft.signoff !== saved.signoff || norm(draft.accent) !== norm(saved.accent) || norm(draft.textColor) !== norm(saved.textColor);
  const err = dirty ? state.tone?.errors : undefined;
  const colourErr = dirty ? state.colour?.errors : undefined;
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useLeaveGuard(dirty);
  const saveAndLeave = useSaveAndLeave(guard, formRef, state);

  return (
    <>
      <PageHeader title="Brand" description="Owners and admins only" />
      <form ref={formRef} action={action} noValidate className="max-w-[920px] space-y-5 pb-24">
        <Card padding="none">
          <CardHeader title="Tone and sign-off" hint="How the agent sounds and signs off." />
          <PanelRow label="Tone" htmlFor="tone" hint="Pick the voice closest to yours." error={err?.tone}>
            <div className="w-60 max-w-full">
              <Select
                id="tone"
                name="tone"
                options={toneOptions(initial.tone)}
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
        </Card>

        <BrandColour
          color={draft.accent}
          text={draft.textColor}
          onColor={(accent) => setDraft((d) => ({ ...d, accent }))}
          onText={(textColor) => setDraft((d) => ({ ...d, textColor }))}
          errors={colourErr}
        />

        <SaveBar visible={dirty} pending={pending} error={state.error} onDiscard={() => setDraft(saved)} />
        <LeaveDialog open={guard.pendingHref !== null} what="your brand changes" onStay={guard.stay} onLeave={guard.leave} onSave={saveAndLeave} />
      </form>
    </>
  );
}
