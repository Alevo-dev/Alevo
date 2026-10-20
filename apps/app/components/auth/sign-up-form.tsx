"use client";

import { useState, type FormEvent } from "react";
import { useClerk, useOrganizationList, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { nextPathAfterAuth } from "./after-auth";
import { toFormErrors, type FormErrors } from "./clerk-errors";
import { PasswordInput } from "./password-input";

const NONE: FormErrors = { fields: {} };
const SITE = "https://getalevo.com";

/** Create account: details → emailed code → workspace created (Clerk custom flow). */
export function SignUpForm() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { createOrganization } = useOrganizationList();
  const clerk = useClerk();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<FormErrors>(NONE);
  const [pending, setPending] = useState(false);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const companyName = String(fd.get("company") ?? "").trim();
    const emailAddress = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const agreed = fd.get("terms") === "yes";

    const fields: FormErrors["fields"] = {};
    if (!name) fields.name = "Enter your name.";
    if (!companyName) fields.company = "Enter your company name.";
    if (!emailAddress) fields.email = "Enter your work email.";
    if (!password) fields.password = "Choose a password.";
    if (!agreed) fields.terms = "You need to agree to continue.";
    if (Object.keys(fields).length) return setErrors({ fields });

    const [firstName, ...rest] = name.split(/\s+/);
    setPending(true);
    setErrors(NONE);
    try {
      await signUp.create({
        firstName,
        lastName: rest.join(" ") || undefined,
        emailAddress,
        password,
        legalAccepted: true,
        unsafeMetadata: { company: companyName },
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setEmail(emailAddress);
      setCompany(companyName);
      setStep("verify");
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setPending(false);
    }
  }

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    if (!code) return setErrors({ fields: { code: "Enter the code from your email." } });
    setPending(true);
    setErrors(NONE);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.status !== "complete") {
        setErrors({ fields: {}, form: "Couldn't finish creating the account. Try again." });
        return;
      }
      await setActive({ session: res.createdSessionId });
      // The company becomes the workspace, which also resolves Clerk's
      // choose-organization task. If it fails, the task page takes over.
      try {
        const org = await createOrganization?.({ name: company });
        if (org) await setActive({ organization: org.id });
      } catch {
        /* handled by the onboarding step */
      }
      router.push(nextPathAfterAuth(clerk));
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (!isLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setErrors({ fields: {}, form: undefined });
    } catch (err) {
      setErrors(toFormErrors(err));
    }
  }

  if (step === "verify") {
    return (
      <form onSubmit={verify} noValidate className="flex flex-col gap-[18px]">
        <p className="text-sm text-ink-muted">
          We sent a code to <span className="font-medium text-ink">{email}</span>. Enter it to finish.
        </p>
        <Field label="Code" htmlFor="su-code" error={errors.fields.code}>
          <Input id="su-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="font-mono tracking-[0.2em]" invalid={!!errors.fields.code} />
        </Field>
        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
        <Button type="submit" variant="primary" loading={pending} disabled={!isLoaded} className="w-full">
          {pending ? "Creating your workspace…" : "Create account"}
        </Button>
        <button type="button" onClick={resend} className="self-center text-sm font-medium text-link hover:underline">
          Send a new code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={create} noValidate className="flex flex-col gap-[18px]">
      <Field label="Full name" htmlFor="su-name" error={errors.fields.name}>
        <Input id="su-name" name="name" autoComplete="name" placeholder="Alex Morgan" invalid={!!errors.fields.name} />
      </Field>
      <Field label="Company" htmlFor="su-company" hint="This becomes your workspace name." error={errors.fields.company}>
        <Input id="su-company" name="company" autoComplete="organization" placeholder="Your MSP" invalid={!!errors.fields.company} />
      </Field>
      <Field label="Work email" htmlFor="su-email" error={errors.fields.email}>
        <Input id="su-email" name="email" type="email" autoComplete="email" placeholder="name@yourmsp.com" invalid={!!errors.fields.email} />
      </Field>
      <Field label="Password" htmlFor="su-password" hint="At least 8 characters." error={errors.fields.password}>
        <PasswordInput id="su-password" name="password" autoComplete="new-password" invalid={!!errors.fields.password} />
      </Field>
      <div>
        <label className="flex items-start gap-2.5 text-sm leading-5 text-ink-muted">
          <input type="checkbox" name="terms" value="yes" className="mt-0.5 size-4 shrink-0 accent-brand" aria-invalid={!!errors.fields.terms || undefined} />
          <span>
            I agree to the{" "}
            <a href={`${SITE}/terms`} target="_blank" rel="noopener noreferrer">
              Terms
            </a>{" "}
            and{" "}
            <a href={`${SITE}/privacy`} target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
            .
          </span>
        </label>
        {errors.fields.terms && <p className="mt-1 text-label text-danger">{errors.fields.terms}</p>}
      </div>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <Button type="submit" variant="primary" loading={pending} disabled={!isLoaded} className="w-full">
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
