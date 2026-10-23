"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { LeaveDialog, UnsavedBar, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { BrandMark } from "@/components/workspace/brand-mark";
import type { ConnectedTool, BookingTool } from "@/lib/booking/connected";
import type { ServiceIcon } from "@/lib/integrations/services";
import { cx } from "@/lib/cx";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { HourRange, LENGTH_OPTIONS } from "./agent-ui";
import { saveBookingSettings, type BookingState, type BookingValues } from "./booking-actions";

const INITIAL: BookingState = {};
const ICON: Record<BookingTool, ServiceIcon> = { calcom: "calcom", google: "google", m365: "microsoft", calendly: "calendly" };
const HOW: Record<BookingTool, string> = {
  calcom: "Cal.com's own availability rules apply.",
  google: "Reads free/busy and books with a Meet link.",
  m365: "Reads free/busy and books with a Teams link.",
  calendly: "The agent sends your scheduling link for the lead to self-book.",
};
const INTEGRATIONS = "/workspace/integrations";

type Props = { initial: BookingValues; connected: ConnectedTool[] };

/**
 * Booking behaviour: a switch, the connected tool the agent books through, and
 * only that tool's settings beneath. Connecting a tool happens under
 * Integrations; this section only offers what is already connected.
 */
export function BookingForm({ initial, connected }: Props) {
  const [state, action, pending] = useActionState(saveBookingSettings, INITIAL);
  useActionToast(state, "Booking settings saved.");
  const { formRef, formKey, dirty, recheck, touch, discard, guard } = useUnsavedForm(state);

  const none = connected.length === 0;
  const [on, setOn] = useState(initial.enabled && !none);
  const [tool, setTool] = useState<BookingTool | null>(initial.tool);
  const discardAll = () => {
    setOn(initial.enabled && !none);
    setTool(initial.tool);
    discard();
  };

  const e = (key: keyof NonNullable<BookingState["errors"]>) => state.errors?.[key];
  const v = <K extends keyof BookingValues>(key: K): BookingValues[K] => (state.values?.[key] ?? initial[key]) as BookingValues[K];

  // The tool in play: the saved/selected one if it is still connected, else the only (or first) connected one.
  const current = connected.find((c) => c.tool === tool) ?? connected[0] ?? null;
  const calendar = current?.tool === "google" || current?.tool === "m365";

  return (
    <form key={formKey} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck} className="space-y-6">
      <Card>
        <CardHeader
          title="Booking"
          hint={
            none
              ? "When on, the agent offers times and books meetings through a connected tool. Nothing is connected yet."
              : "When on, the agent offers times and books meetings through the connected tool. Off means qualified leads are handed to a person to book."
          }
          control={<Switch id="bookingEnabled" name="enabled" checked={on} disabled={none} onChange={(ev) => setOn(ev.target.checked)} />}
          controlId="bookingEnabled"
        />
        <FieldError>{e("tool")}</FieldError>

        {none && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline p-4">
            <p className="text-sm text-ink-muted">Connect Cal.com, Google Calendar, Microsoft 365 or Calendly under Integrations first.</p>
            <Link href={INTEGRATIONS} className={buttonClass("primary", "sm")}>
              Connect a booking tool
            </Link>
          </div>
        )}

        {/* The connected tool stays visible with the switch off, so you can see what
            the agent would book through before turning it on. */}
        {current && (connected.length === 1 || !on) && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline p-4">
            {on && <input type="hidden" name="tool" value={current.tool} />}
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark icon={ICON[current.tool]} />
              <p className="min-w-0 text-sm">
                <span className="font-semibold text-ink">
                  {on ? "Books through" : "Connected:"} {current.label}
                </span>
                {current.detail && <span className="text-ink-muted">, {current.detail}</span>}
                <span className="block text-label text-ink-muted">
                  {on
                    ? HOW[current.tool]
                    : connected.length > 1
                      ? `Also connected: ${connected.filter((c) => c.tool !== current.tool).map((c) => c.label).join(", ")}. Turn booking on to pick one.`
                      : `Turn booking on and the agent books through it. ${HOW[current.tool]}`}
                </span>
              </p>
            </div>
            <Link href={INTEGRATIONS} className="text-label font-semibold text-link hover:underline">
              {on ? "Change" : "Manage"}
            </Link>
          </div>
        )}

        {on && current && connected.length > 1 && (
          <fieldset className="mt-6 space-y-3">
            <legend className="text-sm font-semibold text-ink">Books through</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {connected.map((c) => (
                <label key={c.tool} className="cursor-pointer">
                  <input
                    type="radio"
                    name="tool"
                    value={c.tool}
                    checked={current.tool === c.tool}
                    onChange={() => setTool(c.tool)}
                    className="peer sr-only"
                  />
                  <span
                    className={cx(
                      "flex items-start gap-3 rounded-md border p-4 peer-focus-visible:ring-2 peer-focus-visible:ring-brand",
                      current.tool === c.tool ? "border-brand bg-brand-soft" : "border-control hover:bg-raised",
                    )}
                  >
                    <BrandMark icon={ICON[c.tool]} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{c.label}</span>
                      <span className="mt-1 block text-label text-ink-muted">{c.detail ?? HOW[c.tool]}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-label text-ink-muted">
              Only connected tools are listed.{" "}
              <Link href={INTEGRATIONS} className="font-semibold text-link hover:underline">
                Manage connections
              </Link>
            </p>
          </fieldset>
        )}

        {on && calendar && (
          <div className="mt-6 border-t border-hairline pt-5">
            <SettingRow label="Meeting length" htmlFor="bookingLengthMin">
              <Select id="bookingLengthMin" name="bookingLengthMin" options={LENGTH_OPTIONS} defaultValue={String(v("bookingLengthMin"))} onChange={touch} />
            </SettingRow>
            <SettingRow label="Working hours" hint="Earliest and latest start for a booked meeting, in the agent's default timezone." error={e("bookingHours")}>
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
        )}

        <FieldError>{state.error}</FieldError>
      </Card>

      <UnsavedBar visible={dirty} pending={pending} error={state.error} onDiscard={discardAll} />
      <LeaveDialog open={guard.pendingHref !== null} what="your booking changes" onStay={guard.stay} onLeave={guard.leave} />
    </form>
  );
}
