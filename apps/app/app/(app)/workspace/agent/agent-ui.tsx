"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError, Input } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { LeaveDialog, UnsavedBar, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveAgentSettings, type ActionState, type AgentErrors, type AgentValues } from "./actions";

const INITIAL: ActionState = {};

/** Common US/Canada timezones (empty = fall back to the app default). */
const TIMEZONES = [
  ["", "App default (Eastern)"],
  ["America/New_York", "Eastern, New York"],
  ["America/Toronto", "Eastern, Toronto"],
  ["America/Chicago", "Central, Chicago"],
  ["America/Winnipeg", "Central, Winnipeg"],
  ["America/Denver", "Mountain, Denver"],
  ["America/Edmonton", "Mountain, Edmonton"],
  ["America/Phoenix", "Mountain (no DST), Phoenix"],
  ["America/Los_Angeles", "Pacific, Los Angeles"],
  ["America/Vancouver", "Pacific, Vancouver"],
  ["America/Halifax", "Atlantic, Halifax"],
] as const;

/** Whole-hour options as "HH:00" over [from, to]. */
function hourOptions(from: number, to: number): SelectOption[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => ({
    value: String(h),
    label: `${String(h).padStart(2, "0")}:00`,
  }));
}
const HOURS_START = hourOptions(0, 23);
const HOURS_END = hourOptions(1, 24);
const TIMEZONE_OPTIONS: SelectOption[] = TIMEZONES.map(([value, label]) => ({ value, label }));
export const LENGTH_OPTIONS: SelectOption[] = [15, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} minutes` }));

/** Two hour selects side by side (send window, booking hours). */
export function HourRange({
  startId,
  endId,
  startValue,
  endValue,
  invalid,
  onChange,
}: {
  startId: string;
  endId: string;
  startValue: number;
  endValue: number;
  invalid: boolean;
  onChange?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select id={startId} name={startId} options={HOURS_START} defaultValue={String(startValue)} invalid={invalid} onChange={onChange} aria-label="Earliest" />
      <Select id={endId} name={endId} options={HOURS_END} defaultValue={String(endValue)} invalid={invalid} onChange={onChange} aria-label="Latest" />
    </div>
  );
}

export function AgentForm({ initial, profileReady }: { initial: AgentValues; profileReady: boolean }) {
  const [state, action, pending] = useActionState(saveAgentSettings, INITIAL);
  useActionToast(state, "Agent settings saved.");
  const { formRef, formKey, dirty, recheck, touch, discard, guard } = useUnsavedForm(state);

  const v = <K extends keyof AgentValues>(key: K): AgentValues[K] => (state.values?.[key] ?? initial[key]) as AgentValues[K];
  const e = (key: keyof AgentErrors) => state.errors?.[key];

  return (
    <form key={formKey} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck} className="space-y-6">
      <Card>
        <CardHeader
          title="Agent"
          hint={
            <>
              When on, Alevo replies to new leads, asks qualifying questions and scores fit. Off means new leads wait for a person.
              {!profileReady && (
                <>
                  {" "}
                  Needs the company name, offering and ideal customer in your{" "}
                  <Link href="/workspace/profile">Business profile</Link> first.
                </>
              )}
            </>
          }
          control={<Switch id="enabled" name="enabled" defaultChecked={Boolean(v("enabled"))} />}
          controlId="enabled"
        />
        <FieldError>{e("enabled")}</FieldError>
      </Card>

      <Card>
        <CardHeader
          title="Follow-up"
          hint="When a lead goes quiet, the agent follows up a few times over about a week, then closes the thread. Nudges only go out inside this window, in the contact's own timezone when known. Replies to a brand-new lead are always immediate."
        />
        <div className="mt-6">
          <SettingRow label="Default timezone" htmlFor="timezone" error={e("timezone")}>
            <Select id="timezone" name="timezone" options={TIMEZONE_OPTIONS} defaultValue={v("timezone")} invalid={!!e("timezone")} onChange={touch} />
          </SettingRow>
          <SettingRow label="Send window" hint="Earliest and latest hour a nudge may go out." error={e("sendWindow")}>
            <HourRange
              startId="sendWindowStartHour"
              endId="sendWindowEndHour"
              startValue={v("sendWindowStartHour")}
              endValue={v("sendWindowEndHour")}
              invalid={!!e("sendWindow")}
              onChange={touch}
            />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader title="Channels" hint="Leave the number blank to keep SMS off. Booking has its own section below." />
        <div className="mt-6">
          <SettingRow
            label="SMS number"
            htmlFor="smsFromNumber"
            hint="Your Twilio number in E.164 format. The agent texts from it, replies route back here, and calls to it are answered when phone calls are on."
            error={e("smsFromNumber")}
          >
            <Input id="smsFromNumber" name="smsFromNumber" defaultValue={v("smsFromNumber")} invalid={!!e("smsFromNumber")} placeholder="+15551234567" className="font-mono" />
          </SettingRow>
        </div>
      </Card>

      <UnsavedBar visible={dirty} pending={pending} error={state.error} onDiscard={discard} />
      <LeaveDialog open={guard.pendingHref !== null} what="your agent changes" onStay={guard.stay} onLeave={guard.leave} />
    </form>
  );
}

