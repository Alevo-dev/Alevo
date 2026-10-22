"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { BookingProvider } from "@alevo/db";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { FieldError, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { Select } from "@/components/ui/select";
import { SettingRow } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { LeaveDialog, UnsavedBar, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { BrandMark } from "@/components/workspace/brand-mark";
import { SecretField } from "@/components/workspace/secret-field";
import type { ServiceIcon } from "@/lib/integrations/services";
import { cx } from "@/lib/cx";
import { keyField } from "@/lib/secrets-registry";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { disconnectCalendar, type DisconnectState } from "./actions";
import { HourRange, LENGTH_OPTIONS } from "./agent-ui";
import { connectCalendar, saveBookingSettings, type BookingState, type BookingTool, type BookingValues } from "./booking-actions";

const INITIAL: BookingState = {};
const DISCONNECT_INITIAL: DisconnectState = {};
const NO_SECRETS = { calcom_api_key: "", calcom_webhook_secret: "" };

const TOOLS: { value: BookingTool; label: string; hint: string; icon: ServiceIcon }[] = [
  { value: "calcom", label: "Cal.com", hint: "API key and event type. Cal.com's own availability rules apply.", icon: "calcom" },
  { value: "google", label: "Google Calendar", hint: "Connect a calendar; books with a Meet link.", icon: "google" },
  { value: "m365", label: "Microsoft 365", hint: "Connect a calendar; books with a Teams link.", icon: "microsoft" },
  { value: "calendly", label: "Calendly", hint: "The agent sends your scheduling link. Set up under Integrations.", icon: "calendly" },
];
const CALENDAR_LABEL: Record<string, string> = { google: "Google Calendar", m365: "Microsoft 365" };

type Props = {
  initial: BookingValues;
  calendar: { provider: BookingProvider | null; accountEmail: string | null };
  calcomApiKeySet: boolean;
  calcomWebhookSecretSet: boolean;
  calendlyLinkSet: boolean;
};

/**
 * Booking in one place: a switch, one chosen tool, and only that tool's
 * details beneath it. Single Save/Cancel bar (appears once something changed).
 * Connect + Disconnect are secondary submits of this same form.
 */
export function BookingForm({ initial, calendar, calcomApiKeySet, calcomWebhookSecretSet, calendlyLinkSet }: Props) {
  const [secrets, setSecrets] = useState(NO_SECRETS);
  const [state, action, pending] = useActionState(
    async (prev: BookingState, formData: FormData) => {
      const next = await saveBookingSettings(prev, formData);
      if (next.ok) setSecrets(NO_SECRETS);
      return next;
    },
    INITIAL,
  );
  const [connectState, connectAction, connectPending] = useActionState(connectCalendar, INITIAL);
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(disconnectCalendar, DISCONNECT_INITIAL);
  useActionToast(state, "Booking settings saved.");
  useActionToast(disconnectState, "Calendar disconnected.");
  const { formRef, formKey, dirty, recheck, touch, discard, guard } = useUnsavedForm(state);

  const [on, setOn] = useState(initial.enabled);
  const [tool, setTool] = useState<BookingTool>(initial.tool);
  const discardAll = () => {
    setOn(initial.enabled);
    setTool(initial.tool);
    setSecrets(NO_SECRETS);
    discard();
  };

  const errors = { ...connectState.errors, ...state.errors };
  const e = (key: keyof typeof errors) => errors[key];
  const formError = state.error ?? connectState.error ?? disconnectState.error;
  const v = <K extends keyof BookingValues>(key: K): BookingValues[K] => (state.values?.[key] ?? initial[key]) as BookingValues[K];

  const connected = calendar.provider === "google" || calendar.provider === "m365" ? calendar.provider : null;
  const calendarChosen = tool === "google" || tool === "m365";

  return (
    <form key={formKey} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck} className="space-y-6">
      <Card>
        <CardHeader
          title="Booking"
          hint="When on, the agent offers times and books meetings through one tool. Off means qualified leads are handed to a person to book."
        />
        <div className="mt-2">
          <SettingRow label="Book meetings" htmlFor="bookingEnabled" error={e("tool")}>
            <div className="flex h-10 items-center md:justify-end">
              <Switch id="bookingEnabled" name="enabled" checked={on} onChange={(ev) => setOn(ev.target.checked)} />
            </div>
          </SettingRow>

          {on && (
            <fieldset className="mt-4 space-y-3">
              <legend className="text-sm font-semibold text-ink">Booking tool</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {TOOLS.map((t) => (
                  <label key={t.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="tool"
                      value={t.value}
                      checked={tool === t.value}
                      onChange={() => setTool(t.value)}
                      className="peer sr-only"
                    />
                    <span
                      className={cx(
                        "flex items-start gap-3 rounded-md border p-4 peer-focus-visible:ring-2 peer-focus-visible:ring-brand",
                        tool === t.value ? "border-brand bg-brand-soft" : "border-control hover:bg-raised",
                      )}
                    >
                      <BrandMark icon={t.icon} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{t.label}</span>
                        <span className="mt-1 block text-label text-ink-muted">{t.hint}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {on && tool === "calcom" && (
            <div className="mt-6 space-y-5 border-t border-hairline pt-5">
              <SettingRow
                label="Event type ID"
                htmlFor="calcomEventTypeId"
                hint="The numeric ID of the Cal.com event type the agent books."
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
              <SecretField
                field={keyField("calcom_api_key", calcomApiKeySet)}
                value={secrets.calcom_api_key}
                error={e("calcom_api_key")}
                canReveal
                canModify
                onChange={(next) => setSecrets((s) => ({ ...s, calcom_api_key: next }))}
              />
              <SecretField
                field={keyField("calcom_webhook_secret", calcomWebhookSecretSet)}
                value={secrets.calcom_webhook_secret}
                error={e("calcom_webhook_secret")}
                canReveal
                canModify
                onChange={(next) => setSecrets((s) => ({ ...s, calcom_webhook_secret: next }))}
              />
            </div>
          )}

          {on && calendarChosen && (
            <div className="mt-6 border-t border-hairline pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {connected ? (
                  <>
                    <p className="text-sm">
                      <span className="font-semibold">{CALENDAR_LABEL[connected]}</span>
                      {calendar.accountEmail && <span className="text-ink-muted">, {calendar.accountEmail}</span>}
                      {connected !== tool && (
                        <span className="block text-label text-ink-muted">
                          Disconnect it to connect {CALENDAR_LABEL[tool]} instead.
                        </span>
                      )}
                    </p>
                    <ConfirmSubmit
                      formAction={disconnectAction}
                      loading={disconnectPending}
                      title="Disconnect this calendar?"
                      description="The agent stops booking on it and hands qualified leads to a person until another calendar is connected. Existing meetings are not touched."
                      confirmLabel="Disconnect"
                    >
                      Disconnect
                    </ConfirmSubmit>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-ink-muted">
                      Connect the calendar the agent books on. It reads free/busy and creates events with a video link.
                    </p>
                    <Button type="submit" formAction={connectAction} loading={connectPending} variant="secondary">
                      Connect {CALENDAR_LABEL[tool]}
                    </Button>
                  </>
                )}
              </div>
              <div className="mt-4">
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
            </div>
          )}

          {on && tool === "calendly" && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
              <p className="text-sm text-ink-muted">
                Calendly&apos;s scheduling link and webhook signing key live under Integrations.{" "}
                <Pill tone={calendlyLinkSet ? "success" : "muted"}>{calendlyLinkSet ? "Link set" : "No link yet"}</Pill>
              </p>
              <Link href="/workspace/integrations" className="text-label font-semibold text-link hover:underline">
                Open Integrations
              </Link>
            </div>
          )}

          <FieldError>{formError}</FieldError>
        </div>
      </Card>

      <UnsavedBar visible={dirty} pending={pending} error={state.error} onDiscard={discardAll} />
      <LeaveDialog open={guard.pendingHref !== null} what="your booking changes" onStay={guard.stay} onLeave={guard.leave} />
    </form>
  );
}
