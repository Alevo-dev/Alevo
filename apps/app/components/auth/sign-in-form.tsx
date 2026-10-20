"use client";

import { useState, type FormEvent } from "react";
import { useSignIn } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { toFormErrors, type FormErrors } from "./clerk-errors";
import { PasswordInput } from "./password-input";

const NONE: FormErrors = { fields: {} };

/** Email + password sign-in (Clerk custom flow). */
export function SignInForm({ onForgot }: { onForgot: () => void }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [errors, setErrors] = useState<FormErrors>(NONE);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const fields: FormErrors["fields"] = {};
    if (!email) fields.email = "Enter your work email.";
    if (!password) fields.password = "Enter your password.";
    if (fields.email || fields.password) return setErrors({ fields });

    setPending(true);
    setErrors(NONE);
    try {
      const res = await signIn.create({ strategy: "password", identifier: email, password });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId, redirectUrl: "/dashboard" });
      } else if (res.status === "needs_second_factor") {
        setErrors({ fields: {}, form: "This account uses two-step verification, which isn't supported here yet." });
      } else {
        setErrors({ fields: {}, form: "Couldn't finish signing in. Try again." });
      }
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
      <Field label="Work email" htmlFor="si-email" error={errors.fields.email}>
        <Input id="si-email" name="email" type="email" autoComplete="email" placeholder="name@yourmsp.com" invalid={!!errors.fields.email} />
      </Field>
      <Field label="Password" htmlFor="si-password" error={errors.fields.password}>
        <PasswordInput id="si-password" name="password" autoComplete="current-password" invalid={!!errors.fields.password} />
      </Field>
      <div className="flex justify-end text-sm">
        <button type="button" onClick={onForgot} className="font-medium text-link hover:underline">
          Forgot password?
        </button>
      </div>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <Button type="submit" variant="primary" loading={pending} disabled={!isLoaded} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
