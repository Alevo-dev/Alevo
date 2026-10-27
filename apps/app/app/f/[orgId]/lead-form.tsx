"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Textarea } from "@/components/ui/field";
import { submitLead, type LeadState } from "./actions";

const INITIAL: LeadState = {};

export function LeadForm({ orgId, company }: { orgId: string; company: string }) {
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
      <div className="rounded-md bg-brand-soft p-6 text-center">
        <h2 className="font-sans text-base font-semibold tracking-normal">Thanks. We&apos;ll be in touch shortly.</h2>
        <p className="mt-1 text-sm text-ink-muted">Your message has been received.</p>
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
        <Input name="name" defaultValue={v?.name} invalid={!!e?.name} placeholder="Full name" aria-label="Full name" />
        <FieldError>{e?.name}</FieldError>
      </div>
      <div>
        <Input name="email" type="email" defaultValue={v?.email} invalid={!!e?.email} placeholder="Email" aria-label="Email" />
        <FieldError>{e?.email}</FieldError>
      </div>
      <Input name="phone" type="tel" defaultValue={v?.phone} placeholder="Phone (optional)" aria-label="Phone" />
      <Input name="company" defaultValue={v?.company} placeholder="Company (optional)" aria-label="Company" />
      <Textarea name="message" rows={4} defaultValue={v?.message} placeholder="How can we help?" aria-label="Message" />

      <div>
        <label className="flex items-start gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            name="consent"
            value="yes"
            defaultChecked={v?.consent}
            aria-invalid={!!e?.consent}
            className="mt-0.5 size-4 accent-brand"
          />
          <span>I agree to be contacted about my inquiry.</span>
        </label>
        <FieldError>{e?.consent}</FieldError>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <Button type="submit" variant="primary" loading={pending} className="w-full">
        {pending ? "Sending…" : "Send"}
      </Button>

      <p className="text-center text-label text-ink-muted">
        Your details go to {company} and are processed by Alevo. See the{" "}
        <a href="https://getalevo.com/privacy" target="_blank" rel="noopener noreferrer">
          privacy policy
        </a>
        . Reply to any message to ask for a copy or deletion of your data.
      </p>
    </form>
  );
}
