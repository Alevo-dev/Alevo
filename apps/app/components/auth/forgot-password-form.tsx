"use client";

import { useState, type FormEvent } from "react";
import { useClerk, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { nextPathAfterAuth } from "./after-auth";
import { toFormErrors, type FormErrors } from "./clerk-errors";
import { PasswordInput } from "./password-input";

const NONE: FormErrors = { fields: {} };

/** Reset by emailed code: email → code + new password (Clerk custom flow). */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const clerk = useClerk();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>(NONE);
  const [pending, setPending] = useState(false);

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    const value = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!value) return setErrors({ fields: { email: "Enter your work email." } });
    setPending(true);
    setErrors(NONE);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: value });
      setEmail(value);
      setStep("reset");
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setPending(false);
    }
  }

  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const fields: FormErrors["fields"] = {};
    if (!code) fields.code = "Enter the code from your email.";
    if (!password) fields.password = "Choose a new password.";
    if (fields.code || fields.password) return setErrors({ fields });

    setPending(true);
    setErrors(NONE);
    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code });
      if (attempt.status !== "needs_new_password" && attempt.status !== "complete") {
        throw new Error("That code didn't work. Check it and try again.");
      }
      const res = attempt.status === "complete" ? attempt : await signIn.resetPassword({ password });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.push(nextPathAfterAuth(clerk));
      } else {
        setErrors({ fields: {}, form: "Couldn't finish the reset. Try again." });
      }
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setPending(false);
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} noValidate className="flex flex-col gap-[18px]">
        <Field label="Work email" htmlFor="fp-email" hint="We'll email you a code to set a new password." error={errors.fields.email}>
          <Input id="fp-email" name="email" type="email" autoComplete="email" placeholder="name@yourmsp.com" invalid={!!errors.fields.email} />
        </Field>
        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
        <Button type="submit" variant="primary" loading={pending} disabled={!isLoaded} className="w-full">
          {pending ? "Sending…" : "Send code"}
        </Button>
        <button type="button" onClick={onBack} className="self-center text-sm font-medium text-link hover:underline">
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={reset} noValidate className="flex flex-col gap-[18px]">
      <p className="text-sm text-ink-muted">
        We sent a code to <span className="font-medium text-ink">{email}</span>.
      </p>
      <Field label="Code" htmlFor="fp-code" error={errors.fields.code}>
        <Input id="fp-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="font-mono tracking-[0.2em]" invalid={!!errors.fields.code} />
      </Field>
      <Field label="New password" htmlFor="fp-password" hint="At least 8 characters." error={errors.fields.password}>
        <PasswordInput id="fp-password" name="password" autoComplete="new-password" invalid={!!errors.fields.password} />
      </Field>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <Button type="submit" variant="primary" loading={pending} disabled={!isLoaded} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
      <button type="button" onClick={() => setStep("email")} className="self-center text-sm font-medium text-link hover:underline">
        Use a different email
      </button>
    </form>
  );
}
