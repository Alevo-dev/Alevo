"use client";

import { useState, type FormEvent } from "react";
import { useClerk, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { nextPathAfterAuth } from "./after-auth";
import { PasswordInput } from "./password-input";

/** Local client-side errors (empty fields) merged with Clerk's `errors` signal. */
type Local = { email?: string; password?: string; form?: string };

/** Email + password sign-in (Clerk v7 signals / custom flow). */
export function SignInForm({ onForgot }: { onForgot: () => void }) {
  const { signIn, errors } = useSignIn();
  const clerk = useClerk();
  const router = useRouter();
  const [local, setLocal] = useState<Local>({});
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const l: Local = {};
    if (!email) l.email = "Enter your work email.";
    if (!password) l.password = "Enter your password.";
    if (l.email || l.password) return setLocal(l);

    setLocal({});
    setPending(true);
    // On failure, field/global messages surface through the `errors` signal.
    const { error } = await signIn.password({ identifier: email, password });
    if (error) return setPending(false);
    if (signIn.status === "complete") {
      await signIn.finalize();
      router.push(nextPathAfterAuth(clerk));
    } else {
      setPending(false);
      setLocal({
        form:
          signIn.status === "needs_second_factor"
            ? "This account uses two-step verification, which isn't supported here yet."
            : "Couldn't finish signing in. Try again.",
      });
    }
  }

  const emailError = local.email ?? errors.fields.identifier?.message;
  const passwordError = local.password ?? errors.fields.password?.message;
  const formError = local.form ?? errors.global?.[0]?.message;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4.5">
      <Field label="Work email" htmlFor="si-email" error={emailError}>
        <Input id="si-email" name="email" type="email" autoComplete="email" placeholder="name@yourmsp.com" invalid={!!emailError} />
      </Field>
      <Field label="Password" htmlFor="si-password" error={passwordError}>
        <PasswordInput id="si-password" name="password" autoComplete="current-password" invalid={!!passwordError} />
      </Field>
      <div className="flex justify-end text-sm">
        <button type="button" onClick={onForgot} className="font-medium text-link hover:underline">
          Forgot password?
        </button>
      </div>
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <Button type="submit" variant="primary" loading={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
