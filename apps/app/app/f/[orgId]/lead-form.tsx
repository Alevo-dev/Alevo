"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { HONEYPOT_FIELD } from "@/lib/leads/spam";
import { submitLead, type LeadState } from "./actions";

const INITIAL: LeadState = {};

/** A labelled control: the label is always visible (a placeholder is only an example). */
function Row({ id, label, optional, error, children }: { id: string; label: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </Label>
      {children}
      {/* Always mounted, so a screen reader announces the message when it appears. */}
      <div aria-live="polite">
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}

export function LeadForm({ orgId, company, submitted = false }: { orgId: string; company: string; submitted?: boolean }) {
  const [state, action, pending] = useActionState(submitLead, INITIAL);

  // Set after mount (not during SSR) to avoid a hydration mismatch: the
  // visitor's timezone so follow-up nudges land in their daytime, and when the
  // form was opened, so a submit a second later is treated as a bot.
  // Typing in a field dismisses its error. Tied to the state object it was cleared
  // against, so the next submit's errors all show again without an effect to reset it.
  const [cleared, setCleared] = useState<{ on: LeadState; names: string[] }>({ on: INITIAL, names: [] });
  const dismissed = cleared.on === state ? cleared.names : [];
  const formRef = useRef<HTMLFormElement>(null);
  const tzRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (startedRef.current) startedRef.current.value = String(Date.now());
    try {
      if (tzRef.current) tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      /* no Intl tz: the org default is used instead */
    }
  }, []);

  // After a failed send, move focus to the first field with an error.
  useEffect(() => {
    if (state.errors) formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [state]);

  if (state.ok || submitted) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-brand-soft px-6 py-10 text-center" role="status">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-brand text-on-brand">
          <Check className="size-6" />
        </span>
        <h2 className="mt-4 font-sans text-lg font-semibold tracking-normal">Thanks. We&apos;ll be in touch shortly.</h2>
        <p className="mt-1 text-sm text-ink-muted">Your message has been received. {company} will reply by email or phone.</p>
      </div>
    );
  }

  const v = state.values;
  const e = state.errors && Object.fromEntries(Object.entries(state.errors).filter(([k]) => !dismissed.includes(k)));
  const formError = dismissed.includes("form") ? undefined : state.error;

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      aria-busy={pending || undefined}
      onChange={(ev) => {
        const name = (ev.nativeEvent.target as HTMLInputElement).name;
        if (name) setCleared({ on: state, names: [...dismissed, name, "form"] });
      }}
    >
      <input type="hidden" name="orgId" value={orgId} />
      <input ref={tzRef} type="hidden" name="timezone" />
      <input ref={startedRef} type="hidden" name="startedAt" />
      {/* Honeypot: off-screen and skipped by keyboard and screen readers; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset disabled={pending} className="grid gap-4 disabled:opacity-70 sm:grid-cols-2">
        <Row id="lf-name" label="Full name" error={e?.name}>
          <Input id="lf-name" name="name" autoComplete="name" aria-required="true" defaultValue={v?.name} invalid={!!e?.name} placeholder="Pat Lee" />
        </Row>
        <Row id="lf-email" label="Email" error={e?.email}>
          <Input id="lf-email" name="email" type="email" autoComplete="email" aria-required="true" defaultValue={v?.email} invalid={!!e?.email} placeholder="pat@example.com" />
        </Row>
        <Row id="lf-phone" label="Phone" optional>
          <Input id="lf-phone" name="phone" type="tel" autoComplete="tel" defaultValue={v?.phone} placeholder="(614) 555-0100" />
        </Row>
        <Row id="lf-company" label="Company" optional>
          <Input id="lf-company" name="company" autoComplete="organization" defaultValue={v?.company} placeholder="Your company" />
        </Row>
        <div className="sm:col-span-2">
          <Row id="lf-message" label="How can we help?" error={e?.message}>
            <Textarea id="lf-message" name="message" rows={5} aria-required="true" defaultValue={v?.message} invalid={!!e?.message} placeholder="A few lines about what you need and when." />
          </Row>
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 rounded-md bg-raised p-3 text-sm text-ink-muted">
            <input
              type="checkbox"
              name="consent"
              value="yes"
              defaultChecked={v?.consent}
              aria-invalid={!!e?.consent}
              className="mt-0.5 size-4 shrink-0 accent-brand"
            />
            <span>I agree to be contacted about my inquiry.</span>
          </label>
          <FieldError>{e?.consent}</FieldError>
        </div>

        {formError && <p className="text-sm text-danger sm:col-span-2">{formError}</p>}

        <Button type="submit" variant="primary" loading={pending} className="min-h-11 w-full sm:col-span-2">
          {!pending && <Send className="size-4" aria-hidden="true" />}
          {pending ? "Sending…" : "Send message"}
        </Button>
      </fieldset>

      <p className="mt-4 text-center text-label text-ink-muted">
        Your details go to {company} and are processed by Alevo. See the{" "}
        <a href="https://getalevo.com/privacy" target="_blank" rel="noopener noreferrer">
          privacy policy
        </a>
        . Reply to any message to ask for a copy or deletion of your data.
      </p>
    </form>
  );
}
