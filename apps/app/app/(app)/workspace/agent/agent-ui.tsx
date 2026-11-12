"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError, Input } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { LeaveDialog, UnsavedBar, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { VoicePicker } from "./voice-picker";
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
const AFTER_HOURS_OPTIONS: SelectOption[] = [
  { value: "voicemail", label: "Take a short message and say we'll call back" },
  { value: "take_message", label: "Take details: name, reason and callback number" },
];
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
  // The calls switch follows what is typed in the number field, not only what is saved.
  const [typed, setTyped] = useState<string | null>(null);

  const v = <K extends keyof AgentValues>(key: K): AgentValues[K] => (state.values?.[key] ?? initial[key]) as AgentValues[K];
  const e = (key: keyof AgentErrors) => state.errors?.[key];
  const number = typed ?? v("smsFromNumber");
  const hasNumber = number.trim() !== "";

  return (
    <form key={formKey} ref={formRef} action={action} noValidate onInput={(ev) => {
        recheck();
        const t = ev.target as HTMLInputElement;
        if (t.id === "smsFromNumber") setTyped(t.value);
      }} onChange={recheck} className="space-y-6">
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
          <SettingRow
            label="Phone calls"
            htmlFor="voiceEnabled"
            end
            hint={
              hasNumber
                ? `When on, the same agent that handles texts and emails answers calls to ${number.trim()}.`
                : "Add an SMS number above to turn this on."
            }
            error={e("voiceEnabled")}
          >
            <Switch
              key={hasNumber ? "number" : "no-number"}
              id="voiceEnabled"
              name="voiceEnabled"
              defaultChecked={hasNumber && Boolean(v("voiceEnabled"))}
              disabled={!hasNumber}
            />
          </SettingRow>
          <SettingRow
            label="Voices"
            stacked
            hint="The voice callers hear. Press play to hear a sample. Give a voice a name and the agent introduces itself by it when that voice answers."
            error={e("voiceNames")}
          >
            <VoicePicker selected={v("voiceNames")} labels={v("voiceLabels")} errors={state.labelErrors} />
          </SettingRow>
          <SettingRow
            label="Outside office hours"
            htmlFor="voiceAfterHours"
            hint="Office hours are weekdays within the booking hours, in the default timezone above. With a calendar connected, the agent still offers meeting times after hours when it takes details."
            error={e("voiceAfterHours")}
          >
            <Select id="voiceAfterHours" name="voiceAfterHours" options={AFTER_HOURS_OPTIONS} defaultValue={v("voiceAfterHours")} onChange={touch} />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Notifications"
          hint={
            <>
              Every alert the agent raises — qualified lead, meeting booked, lead handed off or escalated, booking failed, lead needs a person,
              call summaries — goes to your Slack channel when one is connected under <Link href="/workspace/integrations">Integrations</Link>.
            </>
          }
        />
        <div className="mt-6">
          <SettingRow label="Email the team" htmlFor="emailAlerts" end hint="Owners and admins get the same alerts by email. Plan-limit notices are always emailed.">
            <Switch id="emailAlerts" name="emailAlerts" defaultChecked={Boolean(v("emailAlerts"))} />
          </SettingRow>
        </div>
      </Card>

      <UnsavedBar
        visible={dirty}
        pending={pending}
        error={state.error}
        onDiscard={() => {
          discard();
          setTyped(null);
        }}
      />
      <LeaveDialog open={guard.pendingHref !== null} what="your agent changes" onStay={guard.stay} onLeave={guard.leave} />
    </form>
  );
}

