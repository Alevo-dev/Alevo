"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDemoRequest, type ContactState } from "@/app/contact/actions";

const initial: ContactState = { ok: false };

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {msg}
    </p>
  );
}

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    submitDemoRequest,
    initial,
  );

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-10 text-brand-violet" />
        <h2 className="font-display text-2xl font-semibold">You’re on the list</h2>
        <p className="max-w-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-7 shadow-(--shadow-card) sm:p-9"
      noValidate
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Sam Rivera"
            aria-invalid={!!state.errors?.name}
            aria-describedby="err-name"
          />
          <FieldError id="err-name" msg={state.errors?.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="sam@company.com"
            aria-invalid={!!state.errors?.email}
            aria-describedby="err-email"
          />
          <FieldError id="err-email" msg={state.errors?.email} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          name="company"
          autoComplete="organization"
          placeholder="Northwind"
          aria-invalid={!!state.errors?.company}
          aria-describedby="err-company"
        />
        <FieldError id="err-company" msg={state.errors?.company} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">What are you hoping Alevo can do?</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder="We get ~200 inbound leads a month and reply too slowly…"
          aria-invalid={!!state.errors?.message}
          aria-describedby="err-message"
        />
        <FieldError id="err-message" msg={state.errors?.message} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-medium text-white shadow-[0_8px_30px_-8px_color-mix(in_oklab,var(--brand-violet)_60%,transparent)] transition-all [background-image:var(--brand-gradient)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Sending…" : "Request a demo"}
      </button>

      <p className="text-xs text-muted-foreground">
        By submitting, you agree to be contacted about Alevo. We’ll never share
        your details.
      </p>
    </form>
  );
}
