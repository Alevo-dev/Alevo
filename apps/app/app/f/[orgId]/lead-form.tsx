"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitLead, type LeadState } from "./actions";

const INITIAL: LeadState = {};

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-background px-3 py-2 text-sm ${
    hasError ? "border-destructive" : "border-input"
  }`;
}
const errMsg = "mt-1 text-xs text-destructive";

export function LeadForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState(submitLead, INITIAL);

  // Capture the visitor's timezone so follow-up nudges land in their daytime.
  // Set after mount (not during SSR) to avoid a hydration mismatch.
  const tzRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      if (tzRef.current) tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      /* no Intl tz — the org default is used instead */
    }
  }, []);

  if (state.ok) {
    return (
      <div className="rounded-lg border border-border p-6 text-center">
        <h2 className="text-lg">Thanks — we&apos;ll be in touch shortly.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your message has been received.
        </p>
      </div>
    );
  }

  const v = state.values;
  const e = state.errors;

  return (
    <form action={action} noValidate className="space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      <input ref={tzRef} type="hidden" name="timezone" />

      <div>
        <input
          name="name"
          defaultValue={v?.name}
          aria-invalid={!!e?.name}
          placeholder="Full name"
          className={fieldClass(!!e?.name)}
        />
        {e?.name && <p className={errMsg}>{e.name}</p>}
      </div>

      <div>
        <input
          name="email"
          type="email"
          defaultValue={v?.email}
          aria-invalid={!!e?.email}
          placeholder="Email"
          className={fieldClass(!!e?.email)}
        />
        {e?.email && <p className={errMsg}>{e.email}</p>}
      </div>

      <input
        name="phone"
        type="tel"
        defaultValue={v?.phone}
        placeholder="Phone (optional)"
        className={fieldClass(false)}
      />
      <input
        name="company"
        defaultValue={v?.company}
        placeholder="Company (optional)"
        className={fieldClass(false)}
      />
      <textarea
        name="message"
        rows={4}
        defaultValue={v?.message}
        placeholder="How can we help?"
        className={fieldClass(false)}
      />

      <div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="consent"
            value="yes"
            defaultChecked={v?.consent}
            aria-invalid={!!e?.consent}
            className="mt-0.5"
          />
          <span>I agree to be contacted about my inquiry.</span>
        </label>
        {e?.consent && <p className={errMsg}>{e.consent}</p>}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
