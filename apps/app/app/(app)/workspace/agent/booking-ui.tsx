"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PanelRow } from "@/components/workspace/panel-row";
import { BrandMark } from "@/components/workspace/brand-mark";
import type { ConnectedTool, BookingTool } from "@/lib/booking/connected";
import type { ServiceIcon } from "@/lib/integrations/services";
import { cx } from "@/lib/cx";
import { JUMP } from "@/lib/jump";
import type { BookingState, BookingValues } from "./booking-actions";
import { HourRange, LENGTH_OPTIONS } from "./agent-ui";

const ICON: Record<BookingTool, ServiceIcon> = { calcom: "calcom", google: "google", m365: "microsoft", calendly: "calendly" };
const HOW: Record<BookingTool, string> = {
  calcom: "Cal.com's own availability rules apply.",
  google: "Reads free/busy and books with a Meet link.",
  m365: "Reads free/busy and books with a Teams link.",
  calendly: "The agent sends your scheduling link for the lead to self-book.",
};
const INTEGRATIONS = JUMP.integrationsBooking;
const LINK = "rounded-xs font-[550] text-link outline-none hover:underline focus-visible:[box-shadow:var(--ds-focus-ring)]";

type Props = { initial: BookingValues; connected: ConnectedTool[]; state?: BookingState; touch: () => void };

/**
 * The Booking panel of the Agent form: a switch, the connected tool the agent books through,
 * and only that tool's settings beneath. Connecting a tool happens under Integrations; this
 * only offers what is already connected. Saved by the page's one Save.
 */
export function BookingPanel({ initial, connected, state, touch }: Props) {
  const none = connected.length === 0;
  const [on, setOn] = useState(initial.enabled && !none);
  const [tool, setTool] = useState<BookingTool | null>(initial.tool);

  const e = (key: keyof NonNullable<BookingState["errors"]>) => state?.errors?.[key];
  const v = <K extends keyof BookingValues>(key: K): BookingValues[K] => (state?.values?.[key] ?? initial[key]) as BookingValues[K];

  // The tool in play: the saved/selected one if it is still connected, else the only (or first) connected one.
  const current = connected.find((c) => c.tool === tool) ?? connected[0] ?? null;
  const calendar = current?.tool === "google" || current?.tool === "m365";

  return (
    <Card id="booking" padding="none">
      <CardHeader title="Booking" />
      <PanelRow
        label="Book meetings"
        htmlFor="bookingEnabled"
        hint={none ? "Nothing is connected yet" : "Off means qualified leads are handed to a person to book"}
        error={e("tool")}
      >
        <Switch id="bookingEnabled" name="bookingEnabled" checked={on} disabled={none} onChange={(ev) => setOn(ev.target.checked)} />
        {none && <Pill tone="muted">Not connected</Pill>}
      </PanelRow>

      <PanelRow label="Book into" hint="Each tool is connected under Integrations">
        {none && (
          <>
            <span className="text-ink-muted">Cal.com, Google Calendar, Microsoft 365 or Calendly</span>
            <Link href={INTEGRATIONS} className={LINK}>
              Connect a booking tool
            </Link>
          </>
        )}
        {current && connected.length === 1 && (
          <>
            {on && <input type="hidden" name="tool" value={current.tool} />}
            <BrandMark icon={ICON[current.tool]} />
            <span>
              <span className="font-[550] text-ink">{current.label}</span>
              {current.detail && <span className="text-ink-muted">, {current.detail}</span>}
              <span className="block text-label text-ink-muted">{HOW[current.tool]}</span>
            </span>
          </>
        )}
        {current && connected.length > 1 && (
          <div role="radiogroup" aria-label="Book into" className="flex flex-wrap gap-2">
            {connected.map((c) => (
              <label key={c.tool} className="cursor-pointer">
                <input
                  type="radio"
                  name="tool"
                  value={c.tool}
                  checked={current.tool === c.tool}
                  disabled={!on}
                  onChange={() => setTool(c.tool)}
                  className="peer sr-only"
                />
                <span
                  className={cx(
                    "inline-flex h-8 items-center gap-2 rounded-xs border px-2.5 text-[13.5px] font-[550] transition-colors duration-150 ease-out peer-focus-visible:[box-shadow:var(--ds-focus-ring)] peer-disabled:opacity-50",
                    current.tool === c.tool ? "border-brand bg-brand-soft text-ink" : "border-control text-ink-muted hover:bg-raised hover:text-ink",
                  )}
                >
                  {c.label}
                </span>
              </label>
            ))}
          </div>
        )}
        {current && (
          <Link href={INTEGRATIONS} className={LINK}>
            Manage calendars
          </Link>
        )}
      </PanelRow>

      {on && calendar && (
        <>
          <PanelRow label="Meeting length" htmlFor="bookingLengthMin" hint="Only for Google and Microsoft 365">
            <Select id="bookingLengthMin" name="bookingLengthMin" inline className="min-w-36" options={LENGTH_OPTIONS} defaultValue={String(v("bookingLengthMin"))} onChange={touch} />
          </PanelRow>
          <PanelRow label="Working hours" hint="Earliest and latest start, in the default timezone" error={e("bookingHours")}>
            <HourRange
              startId="bookingHoursStart"
              endId="bookingHoursEnd"
              startValue={v("bookingHoursStart")}
              endValue={v("bookingHoursEnd")}
              invalid={!!e("bookingHours")}
              onChange={touch}
            />
          </PanelRow>
        </>
      )}
    </Card>
  );
}
