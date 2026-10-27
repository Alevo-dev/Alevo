"use client";

import { useActionState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { LeaveDialog, UnsavedBar, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveVoiceSettings, type VoiceErrors, type VoiceState, type VoiceValues } from "./voice-actions";

const INITIAL: VoiceState = {};

const AFTER_HOURS_OPTIONS: SelectOption[] = [
  { value: "voicemail", label: "Take a short message and say we'll call back" },
  { value: "take_message", label: "Take details: name, reason and callback number" },
];

/** Phone calls: answer on the org's number, and what happens outside office hours. */
export function VoiceForm({ initial, phoneNumber }: { initial: VoiceValues; phoneNumber: string | null }) {
  const [state, action, pending] = useActionState(saveVoiceSettings, INITIAL);
  useActionToast(state, "Phone settings saved.");
  const { formRef, formKey, dirty, recheck, discard, guard } = useUnsavedForm(state);

  const v = <K extends keyof VoiceValues>(key: K): VoiceValues[K] => (state.values?.[key] ?? initial[key]) as VoiceValues[K];
  const e = (key: keyof VoiceErrors) => state.errors?.[key];

  return (
    <form key={formKey} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck} className="space-y-6">
      <Card>
        <CardHeader
          title="Phone calls"
          hint={
            phoneNumber
              ? `When on, the same agent that handles texts and emails answers calls to ${phoneNumber}.`
              : "The same agent that handles texts and emails answers calls to the organization's number. Needs a phone number first (set it above)."
          }
          control={<Switch id="voiceEnabled" name="enabled" defaultChecked={v("enabled")} />}
          controlId="voiceEnabled"
        />
        <FieldError>{e("enabled")}</FieldError>
        <div className="mt-6">
          <SettingRow
            label="Outside office hours"
            htmlFor="afterHours"
            hint="Office hours are weekdays within the booking hours, in the default timezone set above. With a calendar connected, the agent still offers meeting times after hours when it takes details."
            error={e("afterHours")}
          >
            <Select id="afterHours" name="afterHours" options={AFTER_HOURS_OPTIONS} defaultValue={v("afterHours")} />
          </SettingRow>
        </div>
      </Card>

      <UnsavedBar visible={dirty} pending={pending} error={state.error} onDiscard={discard} />
      <LeaveDialog open={guard.pendingHref !== null} what="your phone changes" onStay={guard.stay} onLeave={guard.leave} />
    </form>
  );
}
