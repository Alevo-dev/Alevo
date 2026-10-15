"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveProfile, type ActionState, type ProfileErrors, type ProfileValues } from "./actions";

const INITIAL: ActionState = {};

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-background px-3 py-2 text-sm ${
    hasError ? "border-destructive" : "border-input"
  }`;
}
const errMsg = "mt-1 text-xs text-destructive";
const labelClass = "block text-sm font-medium";
const hintClass = "text-xs text-muted-foreground";

/** Common US/Canada timezones (empty = fall back to the app default). */
const TIMEZONES = [
  ["", "App default (Eastern)"],
  ["America/New_York", "Eastern — New York"],
  ["America/Toronto", "Eastern — Toronto"],
  ["America/Chicago", "Central — Chicago"],
  ["America/Winnipeg", "Central — Winnipeg"],
  ["America/Denver", "Mountain — Denver"],
  ["America/Edmonton", "Mountain — Edmonton"],
  ["America/Phoenix", "Mountain (no DST) — Phoenix"],
  ["America/Los_Angeles", "Pacific — Los Angeles"],
  ["America/Vancouver", "Pacific — Vancouver"],
  ["America/Halifax", "Atlantic — Halifax"],
] as const;

/** Render whole-hour options as "HH:00" over [from, to]. */
function hourOptions(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => (
    <option key={h} value={h}>
      {String(h).padStart(2, "0")}:00
    </option>
  ));
}

export function QualifierForm({ initial }: { initial: ProfileValues }) {
  const [state, action, pending] = useActionState(saveProfile, INITIAL);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  // Echo submitted values back on error; fall back to the saved profile.
  const v = <K extends keyof ProfileValues>(key: K): ProfileValues[K] =>
    (state.values?.[key] ?? initial[key]) as ProfileValues[K];
  const e = (key: keyof ProfileErrors) => state.errors?.[key];

  return (
    <form action={action} noValidate className="space-y-6">
      <label className="flex items-start gap-3 rounded-lg border border-border p-4">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={Boolean(v("enabled"))}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="text-sm font-medium">Enable the Qualifier</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            When on, Alevo replies to new leads, asks qualifying questions, and scores fit
            automatically. Company name, offering, and ideal customer are required to enable.
          </span>
        </span>
      </label>

      <div className="space-y-1">
        <label htmlFor="companyName" className={labelClass}>
          Company name
        </label>
        <input
          id="companyName"
          name="companyName"
          defaultValue={v("companyName")}
          aria-invalid={!!e("companyName")}
          className={fieldClass(!!e("companyName"))}
          placeholder="Northwind IT"
        />
        {e("companyName") && <p className={errMsg}>{e("companyName")}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="offering" className={labelClass}>
          What you offer
        </label>
        <p className={hintClass}>What you sell or do — the Qualifier grounds its replies in this.</p>
        <textarea
          id="offering"
          name="offering"
          rows={3}
          defaultValue={v("offering")}
          aria-invalid={!!e("offering")}
          className={fieldClass(!!e("offering"))}
          placeholder="Managed IT, cybersecurity, and helpdesk for 20–200 seat businesses in the Midwest."
        />
        {e("offering") && <p className={errMsg}>{e("offering")}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="idealCustomer" className={labelClass}>
          Ideal customer (ICP)
        </label>
        <p className={hintClass}>Who&apos;s a great fit — size, industry, pain points.</p>
        <textarea
          id="idealCustomer"
          name="idealCustomer"
          rows={3}
          defaultValue={v("idealCustomer")}
          aria-invalid={!!e("idealCustomer")}
          className={fieldClass(!!e("idealCustomer"))}
          placeholder="25–150 employees, no in-house IT, in healthcare/finance/legal, frustrated with slow support."
        />
        {e("idealCustomer") && <p className={errMsg}>{e("idealCustomer")}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="qualifyingCriteria" className={labelClass}>
          Qualifying criteria
        </label>
        <p className={hintClass}>What to confirm before handing a lead to a human.</p>
        <textarea
          id="qualifyingCriteria"
          name="qualifyingCriteria"
          rows={3}
          defaultValue={v("qualifyingCriteria")}
          className={fieldClass(false)}
          placeholder="Company size, current IT setup, timeline, and who owns the decision."
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="disqualifiers" className={labelClass}>
          Disqualifiers
        </label>
        <p className={hintClass}>Red flags that mean this isn&apos;t a fit.</p>
        <textarea
          id="disqualifiers"
          name="disqualifiers"
          rows={2}
          defaultValue={v("disqualifiers")}
          className={fieldClass(false)}
          placeholder="Individuals/home users, under 10 seats, or outside our service region."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="tone" className={labelClass}>
            Tone &amp; voice
          </label>
          <input
            id="tone"
            name="tone"
            defaultValue={v("tone")}
            className={fieldClass(false)}
            placeholder="Friendly, concise, no jargon."
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="signoff" className={labelClass}>
            Sign off as
          </label>
          <input
            id="signoff"
            name="signoff"
            defaultValue={v("signoff")}
            className={fieldClass(false)}
            placeholder="Sam from Northwind IT"
          />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Follow-up</legend>
        <p className={hintClass}>
          When a lead goes quiet, Alevo follows up a few times over about a week, then closes the
          thread. Nudges only go out inside the window below — in the contact&apos;s own timezone
          when we know it, otherwise the default below. Replies to a brand-new lead are always
          immediate.
        </p>

        <div className="space-y-1">
          <label htmlFor="timezone" className={labelClass}>
            Default timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={v("timezone")}
            aria-invalid={!!e("timezone")}
            className={fieldClass(!!e("timezone"))}
          >
            {TIMEZONES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {e("timezone") && <p className={errMsg}>{e("timezone")}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="sendWindowStartHour" className={labelClass}>
              Earliest
            </label>
            <select
              id="sendWindowStartHour"
              name="sendWindowStartHour"
              defaultValue={String(v("sendWindowStartHour"))}
              aria-invalid={!!e("sendWindow")}
              className={fieldClass(!!e("sendWindow"))}
            >
              {hourOptions(0, 23)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="sendWindowEndHour" className={labelClass}>
              Latest
            </label>
            <select
              id="sendWindowEndHour"
              name="sendWindowEndHour"
              defaultValue={String(v("sendWindowEndHour"))}
              aria-invalid={!!e("sendWindow")}
              className={fieldClass(!!e("sendWindow"))}
            >
              {hourOptions(1, 24)}
            </select>
          </div>
        </div>
        {e("sendWindow") && <p className={errMsg}>{e("sendWindow")}</p>}
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="smsFromNumber" className={labelClass}>
          SMS number (Twilio)
        </label>
        <p className={hintClass}>
          Your Twilio number in E.164 format. The Qualifier texts from it, and replies to it route
          back here. Leave blank if you&apos;re not using SMS.
        </p>
        <input
          id="smsFromNumber"
          name="smsFromNumber"
          defaultValue={v("smsFromNumber")}
          aria-invalid={!!e("smsFromNumber")}
          className={fieldClass(!!e("smsFromNumber"))}
          placeholder="+15551234567"
        />
        {e("smsFromNumber") && <p className={errMsg}>{e("smsFromNumber")}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.ok && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
    </form>
  );
}
