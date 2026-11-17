"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { SubTabs } from "@/components/ui/nav-kit";
import { Pill } from "@/components/ui/pill";
import { Select, type SelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LeaveDialog, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { PanelRow } from "@/components/workspace/panel-row";
import { SaveBar } from "@/components/workspace/save-bar";
import type { ConnectedTool } from "@/lib/booking/connected";
import { JUMP } from "@/lib/jump";
import { timezoneOptions } from "@/lib/timezones";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { VoicePicker } from "./voice-picker";
import { BookingPanel } from "./booking-ui";
import { saveAgentPage, type PageState } from "./save-all";
import type { AgentErrors, AgentValues } from "./actions";
import type { BookingValues } from "./booking-actions";

const INITIAL: PageState = {};

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
    <>
      <Select id={startId} name={startId} inline className="min-w-28" options={HOURS_START} defaultValue={String(startValue)} invalid={invalid} onChange={onChange} aria-label="Earliest" />
      <span className="text-ink-muted">to</span>
      <Select id={endId} name={endId} inline className="min-w-28" options={HOURS_END} defaultValue={String(endValue)} invalid={invalid} onChange={onChange} aria-label="Latest" />
    </>
  );
}

const TABS = [
  { key: "general", label: "General" },
  { key: "booking", label: "Booking" },
  { key: "channels", label: "Channels" },
  { key: "notifications", label: "Notifications" },
] as const;
type Tab = (typeof TABS)[number]["key"];
const LINK = "rounded-xs font-[550] text-link outline-none hover:underline focus-visible:[box-shadow:var(--ds-focus-ring)]";

type Props = {
  initial: AgentValues;
  booking: BookingValues;
  connected: ConnectedTool[];
  profileReady: boolean;
  slackConnected: boolean;
  /** "96 of 300 minutes used", or null when the plan has no call minutes. */
  minutesUsed: string | null;
};

/**
 * The whole Agent page as ONE form with one Save: sub-tabs switch which panels show (all stay
 * mounted, so nothing typed is lost), and a jump link to `#booking` / `#channels` opens its tab.
 */
export function AgentForm({ initial, booking, connected, profileReady, slackConnected, minutesUsed }: Props) {
  const [state, action, pending] = useActionState(saveAgentPage, INITIAL);
  useActionToast(state, "Agent settings saved.");
  const { formRef, formKey, dirty, recheck, touch, discard, guard, saveAndLeave } = useUnsavedForm(state);
  const [tab, setTab] = useState<Tab>("general");
  // The calls switch follows what is typed in the number field, not only what is saved.
  const [typed, setTyped] = useState<string | null>(null);
  const [agentOn, setAgentOn] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const hit = TABS.find((t) => t.key === id);
      if (hit) setTab(hit.key);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const a = state.agent;
  const v = <K extends keyof AgentValues>(key: K): AgentValues[K] => (a?.values?.[key] ?? initial[key]) as AgentValues[K];
  const e = (key: keyof AgentErrors) => a?.errors?.[key];
  const number = typed ?? v("smsFromNumber");
  const hasNumber = number.trim() !== "";
  const on = agentOn ?? Boolean(v("enabled"));
  const show = (t: Tab) => ({ hidden: tab !== t });

  return (
    <form
      key={formKey}
      ref={formRef}
      action={action}
      noValidate
      onInput={(ev) => {
        recheck();
        const t = ev.target as HTMLInputElement;
        if (t.id === "smsFromNumber") setTyped(t.value);
      }}
      onChange={recheck}
      className="space-y-5"
    >
      <SubTabs label="Agent settings" value={tab} options={TABS.map((t) => ({ key: t.key, label: t.label, onSelect: () => setTab(t.key) }))} />

      <div {...show("general")} className="space-y-5">
        <Card padding="none">
          <CardHeader title="Agent" aside={dirty ? <Pill tone="warning">Unsaved</Pill> : <Pill tone="success">Saved</Pill>} />
          <PanelRow
            label="Agent is on"
            htmlFor="enabled"
            hint={
              profileReady ? (
                "Turning it on needs the profile&apos;s three required fields (done)"
              ) : (
                <>
                  Turning it on needs the profile&apos;s three required fields (not done: <Link href="/workspace/profile" className={LINK}>fill in the Profile</Link>)
                </>
              )
            }
            error={e("enabled")}
          >
            <Switch id="enabled" name="enabled" defaultChecked={Boolean(v("enabled"))} onChange={(ev) => setAgentOn(ev.target.checked)} />
            <Pill tone={on ? "success" : "muted"}>{on ? "Online, answering new leads" : "Off, new leads wait for a person"}</Pill>
          </PanelRow>
          <PanelRow label="Follow-up" hint="Nudges a quiet lead; stops when they reply" error={e("sendWindow")}>
            <span className="text-ink">Day 1, day 4, day 7, then close</span>
            <span className="text-ink-muted">Send window</span>
            <HourRange
              startId="sendWindowStartHour"
              endId="sendWindowEndHour"
              startValue={v("sendWindowStartHour")}
              endValue={v("sendWindowEndHour")}
              invalid={!!e("sendWindow")}
              onChange={touch}
            />
            <span className="text-ink-muted">in the contact&apos;s timezone</span>
          </PanelRow>
          <PanelRow label="Default timezone" htmlFor="timezone" hint="Required to turn the agent on. Times are offered in it until a contact's own is known" error={e("timezone")}>
            <Select id="timezone" name="timezone" inline className="min-w-56" options={timezoneOptions(initial.timezone)} defaultValue={v("timezone")} invalid={!!e("timezone")} onChange={touch} />
          </PanelRow>
        </Card>
      </div>

      <div {...show("booking")}>
        <BookingPanel initial={booking} connected={connected} state={state.booking} touch={touch} />
      </div>

      <div {...show("channels")}>
        <Card id="channels" padding="none">
          <CardHeader title="Channels" />
          <PanelRow
            label="SMS number"
            htmlFor="smsFromNumber"
            hint="Outbound texts send from it; inbound texts route by it"
            error={e("smsFromNumber")}
          >
            <Input id="smsFromNumber" name="smsFromNumber" inline className="min-w-52 font-mono" defaultValue={v("smsFromNumber")} invalid={!!e("smsFromNumber")} placeholder="+15551234567" />
          </PanelRow>
          <PanelRow
            label="Phone calls"
            htmlFor="voiceEnabled"
            hint={hasNumber ? "The same agent answers calls on that number" : "Add an SMS number to turn this on"}
            error={e("voiceEnabled")}
          >
            <Switch
              key={hasNumber ? "number" : "no-number"}
              id="voiceEnabled"
              name="voiceEnabled"
              defaultChecked={hasNumber && Boolean(v("voiceEnabled"))}
              disabled={!hasNumber}
            />
            {minutesUsed && <span className="text-ink-muted">{minutesUsed}</span>}
          </PanelRow>
          <VoicePicker selected={v("voiceNames")} labels={v("voiceLabels")} error={e("voiceNames")} labelErrors={a?.labelErrors} />
          <PanelRow
            label="Outside office hours"
            htmlFor="voiceAfterHours"
            hint="Same greeting; takes details or books after hours"
            error={e("voiceAfterHours")}
          >
            <Select id="voiceAfterHours" name="voiceAfterHours" inline className="min-w-72" options={AFTER_HOURS_OPTIONS} defaultValue={v("voiceAfterHours")} onChange={touch} />
          </PanelRow>
        </Card>
      </div>

      <div {...show("notifications")}>
        <Card id="notifications" padding="none">
          <CardHeader title="Notifications" />
          <PanelRow label="Email the team" htmlFor="emailAlerts" hint="Alerts also post to Slack. Plan-limit emails ignore this">
            <Switch id="emailAlerts" name="emailAlerts" defaultChecked={Boolean(v("emailAlerts"))} />
            <span className="text-ink-muted">Owners and admins</span>
          </PanelRow>
          <PanelRow label="Slack" hint="Strong-fit leads, bookings, hand-offs, booking failures">
            <Pill tone={slackConnected ? "success" : "muted"}>{slackConnected ? "Connected" : "Not connected"}</Pill>
            <Link href={JUMP.integrationsCommunication} className={LINK}>
              Manage in Integrations
            </Link>
          </PanelRow>
        </Card>
      </div>

      <SaveBar
        visible={dirty}
        pending={pending}
        error={state.error}
        onDiscard={() => {
          discard();
          setTyped(null);
          setAgentOn(null);
        }}
      />
      <LeaveDialog open={guard.pendingHref !== null} what="your agent changes" onStay={guard.stay} onLeave={guard.leave} onSave={saveAndLeave} />
    </form>
  );
}
