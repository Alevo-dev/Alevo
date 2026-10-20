"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { BookingProvider } from "@alevo/db";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { FieldError, Input, Textarea } from "@/components/ui/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { Pill } from "@/components/ui/pill";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { LeaveDialog, UnsavedBar, useFormDirty, useLeaveGuard } from "@/components/ui/unsaved-changes";
import { useActionToast } from "@/lib/ui/use-action-toast";
import {
  disconnectCalendar,
  saveProfile,
  type ActionState,
  type DisconnectState,
  type ProfileErrors,
  type ProfileValues,
} from "./actions";

const INITIAL: ActionState = {};
const DISCONNECT_INITIAL: DisconnectState = {};

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
const LENGTH_OPTIONS: SelectOption[] = [15, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} minutes` }));

/** Two hour selects side by side (send window, booking hours). */
function HourRange({
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

export function QualifierForm({ initial }: { initial: ProfileValues }) {
  const [state, action, pending] = useActionState(saveProfile, INITIAL);
  useActionToast(state, "Qualifier settings saved.");

  const formRef = useRef<HTMLFormElement>(null);
  // Bumping the key remounts every field at its saved value (= Discard).
  const [formKey, setFormKey] = useState(0);
  const { dirty, recheck, touch, markClean } = useFormDirty(formRef);
  const guard = useLeaveGuard(dirty);

  // A successful save makes the current values the new baseline.
  useEffect(() => {
    if (state.ok) queueMicrotask(markClean);
  }, [state, markClean]);

  const discard = () => {
    setFormKey((k) => k + 1);
    setTimeout(markClean, 0);
  };

  // Echo submitted values back on error; fall back to the saved profile.
  const v = <K extends keyof ProfileValues>(key: K): ProfileValues[K] =>
    (state.values?.[key] ?? initial[key]) as ProfileValues[K];
  const e = (key: keyof ProfileErrors) => state.errors?.[key];

  return (
    <form key={formKey} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck} className="space-y-6">
      <Card>
        <CardHeader
          title="The agent"
          hint="When on, Alevo replies to new leads, asks qualifying questions and scores fit. Company name, offering and ideal customer are required to turn it on."
        />
        <div className="mt-2">
          <SettingRow label="Agent is on" htmlFor="enabled" hint="Off means new leads wait for a person.">
            <div className="flex h-10 items-center md:justify-end">
              <Switch id="enabled" name="enabled" defaultChecked={Boolean(v("enabled"))} />
            </div>
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your business" hint="The agent grounds every reply in this." />
        <div className="mt-6">
          <SettingRow label="Company name" htmlFor="companyName" error={e("companyName")}>
            <Input id="companyName" name="companyName" defaultValue={v("companyName")} invalid={!!e("companyName")} placeholder="Northwind IT" />
          </SettingRow>
          <SettingRow label="What you offer" htmlFor="offering" hint="What you sell or do." error={e("offering")}>
            <Textarea
              id="offering"
              name="offering"
              rows={3}
              defaultValue={v("offering")}
              invalid={!!e("offering")}
              placeholder="Managed IT, cybersecurity and helpdesk for 20 to 200 seat businesses in the Midwest."
            />
          </SettingRow>
          <SettingRow label="Ideal customer" htmlFor="idealCustomer" hint="Who's a great fit: size, industry, pain points." error={e("idealCustomer")}>
            <Textarea
              id="idealCustomer"
              name="idealCustomer"
              rows={3}
              defaultValue={v("idealCustomer")}
              invalid={!!e("idealCustomer")}
              placeholder="25 to 150 employees, no in-house IT, in healthcare, finance or legal, frustrated with slow support."
            />
          </SettingRow>
          <SettingRow label="Qualifying criteria" htmlFor="qualifyingCriteria" hint="What to confirm before handing a lead to a person.">
            <Textarea
              id="qualifyingCriteria"
              name="qualifyingCriteria"
              rows={3}
              defaultValue={v("qualifyingCriteria")}
              placeholder="Company size, current IT setup, timeline, and who owns the decision."
            />
          </SettingRow>
          <SettingRow label="Disqualifiers" htmlFor="disqualifiers" hint="A lead that matches any of these is marked not a fit.">
            <Textarea
              id="disqualifiers"
              name="disqualifiers"
              rows={2}
              defaultValue={v("disqualifiers")}
              placeholder="Individuals or home users, under 10 seats, or outside our service region."
            />
          </SettingRow>
          <SettingRow label="Tone and voice" htmlFor="tone">
            <Input id="tone" name="tone" defaultValue={v("tone")} placeholder="Friendly, concise, no jargon." />
          </SettingRow>
          <SettingRow label="Sign off as" htmlFor="signoff">
            <Input id="signoff" name="signoff" defaultValue={v("signoff")} placeholder="Sam from Northwind IT" />
          </SettingRow>
        </div>
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
        <CardHeader title="Channels and booking" hint="Leave a field blank to leave that channel or booking mode off." />
        <div className="mt-6">
          <SettingRow
            label="SMS number"
            htmlFor="smsFromNumber"
            hint="Your Twilio number in E.164 format. The agent texts from it, and replies route back here."
            error={e("smsFromNumber")}
          >
            <Input
              id="smsFromNumber"
              name="smsFromNumber"
              defaultValue={v("smsFromNumber")}
              invalid={!!e("smsFromNumber")}
              placeholder="+15551234567"
              className="font-mono"
            />
          </SettingRow>
          <SettingRow
            label="Cal.com event type ID"
            htmlFor="calcomEventTypeId"
            hint="With a Cal.com API key set in Integrations, this turns on the booking tools."
            error={e("calcomEventTypeId")}
          >
            <Input
              id="calcomEventTypeId"
              name="calcomEventTypeId"
              inputMode="numeric"
              defaultValue={v("calcomEventTypeId")}
              invalid={!!e("calcomEventTypeId")}
              placeholder="123456"
              className="font-mono"
            />
          </SettingRow>
          <SettingRow
            label="Calendly scheduling link"
            htmlFor="calendlyUrl"
            hint="The agent sends this for leads to book themselves. Cal.com takes precedence if both are set."
            error={e("calendlyUrl")}
          >
            <Input
              id="calendlyUrl"
              name="calendlyUrl"
              defaultValue={v("calendlyUrl")}
              invalid={!!e("calendlyUrl")}
              placeholder="https://calendly.com/your-team/30min"
            />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Calendar booking"
          hint="Used with a connected Google or Microsoft 365 calendar. The agent offers open weekday times inside this window, in the contact's timezone, and books with a video link. Cal.com uses its own availability rules instead."
        />
        <div className="mt-6">
          <SettingRow label="Meeting length" htmlFor="bookingLengthMin">
            <Select id="bookingLengthMin" name="bookingLengthMin" options={LENGTH_OPTIONS} defaultValue={String(v("bookingLengthMin"))} onChange={touch} />
          </SettingRow>
          <SettingRow label="Working hours" hint="Earliest and latest start for a booked meeting." error={e("bookingHours")}>
            <HourRange
              startId="bookingHoursStart"
              endId="bookingHoursEnd"
              startValue={v("bookingHoursStart")}
              endValue={v("bookingHoursEnd")}
              invalid={!!e("bookingHours")}
              onChange={touch}
            />
          </SettingRow>
        </div>
      </Card>

      <UnsavedBar visible={dirty} pending={pending} error={state.error} onDiscard={discard} />
      <LeaveDialog
        open={guard.pendingHref !== null}
        what="your Qualifier changes"
        onStay={guard.stay}
        onLeave={guard.leave}
      />
    </form>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Calendar",
  m365: "Microsoft 365",
};

/**
 * Connect / disconnect a booking calendar over OAuth. Lives outside the profile
 * form (it has its own action + the connect links are plain navigations).
 */
export function CalendarConnection({
  provider,
  accountEmail,
}: {
  provider: BookingProvider | null;
  accountEmail: string | null;
}) {
  const [state, action, pending] = useActionState(disconnectCalendar, DISCONNECT_INITIAL);
  useActionToast(state, "Calendar disconnected.");

  const connected = provider === "google" || provider === "m365";

  return (
    <Card>
      <CardHeader
        title="Booking calendar"
        hint="Connect the calendar the agent should book on. It reads your free/busy and creates events with a Google Meet or Teams link. One calendar per workspace."
        aside={connected ? <Pill tone="success">Connected</Pill> : <Pill tone="muted">Not connected</Pill>}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {connected ? (
          <>
            <p className="text-sm">
              <span className="font-semibold">{PROVIDER_LABEL[provider] ?? provider}</span>
              {accountEmail && <span className="text-ink-muted">, {accountEmail}</span>}
            </p>
            <form action={action}>
              <ConfirmSubmit
                disabled={pending}
                title="Disconnect this calendar?"
                description="The agent stops booking on it and falls back to Cal.com, Calendly or a handoff. Existing meetings are not touched."
                confirmLabel="Disconnect"
              >
                {pending ? "Disconnecting…" : "Disconnect"}
              </ConfirmSubmit>
            </form>
          </>
        ) : (
          <div className="flex flex-wrap gap-3">
            <a href="/api/oauth/google/start" className={buttonClass("secondary")}>
              Connect Google Calendar
            </a>
            <a href="/api/oauth/microsoft/start" className={buttonClass("secondary")}>
              Connect Microsoft 365
            </a>
          </div>
        )}
      </div>
      <FieldError>{state.error}</FieldError>
    </Card>
  );
}
