"use client";

import { useState, type FormEvent } from "react";
import { useClerk, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { nextPathAfterAuth } from "./after-auth";
import { PasswordInput } from "./password-input";

type Local = { email?: string; code?: string; password?: string; form?: string };

/** Reset by emailed code: email → code + new password (Clerk v7 signals). */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { signIn, errors } = useSignIn();
  const clerk = useClerk();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [local, setLocal] = useState<Local>({});
  const [pending, setPending] = useState(false);

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!value) return setLocal({ email: "Enter your work email." });
    setLocal({});
    setPending(true);
    // Seed the sign-in with the identifier, then email a reset code.
    const created = await signIn.create({ identifier: value });
    if (created.error) return setPending(false);
    const sent = await signIn.resetPasswordEmailCode.sendCode();
    if (sent.error) return setPending(false);
    setEmail(value);
    setPending(false);
    setStep("reset");
  }

  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const l: Local = {};
    if (!code) l.code = "Enter the code from your email.";
    if (!password) l.password = "Choose a new password.";
    if (l.code || l.password) return setLocal(l);

    setLocal({});
    setPending(true);
    const verified = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (verified.error) return setPending(false);
    const submitted = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (submitted.error) return setPending(false);
    if (signIn.status === "complete") {
      await signIn.finalize();
      router.push(nextPathAfterAuth(clerk));
    } else {
      setPending(false);
      setLocal({ form: "Couldn't finish the reset. Try again." });
    }
  }

  const emailError = local.email ?? errors.fields.identifier?.message;
  const codeError = local.code ?? errors.fields.code?.message;
  const passwordError = local.password ?? errors.fields.password?.message;
  const formError = local.form ?? errors.global?.[0]?.message;

  if (step === "email") {
    return (
      <form onSubmit={sendCode} noValidate className="flex flex-col gap-4.5">
        <Field label="Work email" htmlFor="fp-email" hint="We'll email you a code to set a new password." error={emailError}>
          <Input id="fp-email" name="email" type="email" autoComplete="email" placeholder="name@yourmsp.com" invalid={!!emailError} />
        </Field>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <Button type="submit" variant="primary" loading={pending} className="w-full">
          {pending ? "Sending…" : "Send code"}
        </Button>
        <button type="button" onClick={onBack} className="self-center text-sm font-medium text-link hover:underline">
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={reset} noValidate className="flex flex-col gap-4.5">
      <p className="text-sm text-ink-muted">
        We sent a code to <span className="font-medium text-ink">{email}</span>.
      </p>
      <Field label="Code" htmlFor="fp-code" error={codeError}>
        <Input id="fp-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="font-mono tracking-[0.2em]" invalid={!!codeError} />
      </Field>
      <Field label="New password" htmlFor="fp-password" hint="At least 8 characters." error={passwordError}>
        <PasswordInput id="fp-password" name="password" autoComplete="new-password" invalid={!!passwordError} />
      </Field>
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <Button type="submit" variant="primary" loading={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
      <button type="button" onClick={() => setStep("email")} className="self-center text-sm font-medium text-link hover:underline">
        Use a different email
      </button>
    </form>
  );
}
