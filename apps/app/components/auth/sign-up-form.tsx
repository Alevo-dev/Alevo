"use client";

import { useState, type FormEvent } from "react";
import { useClerk, useOrganizationList, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { nextPathAfterAuth } from "./after-auth";
import { PasswordInput } from "./password-input";

const SITE = "https://getalevo.com";

type Local = { name?: string; company?: string; email?: string; password?: string; terms?: string; code?: string; form?: string };

/** Create account: details → emailed code → workspace created (Clerk v7 signals). */
export function SignUpForm() {
  const router = useRouter();
  const { signUp, errors } = useSignUp();
  const { createOrganization } = useOrganizationList();
  const clerk = useClerk();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [local, setLocal] = useState<Local>({});
  const [pending, setPending] = useState(false);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const companyName = String(fd.get("company") ?? "").trim();
    const emailAddress = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const agreed = fd.get("terms") === "yes";

    const l: Local = {};
    if (!name) l.name = "Enter your name.";
    if (!companyName) l.company = "Enter your company name.";
    if (!emailAddress) l.email = "Enter your work email.";
    if (!password) l.password = "Choose a password.";
    if (!agreed) l.terms = "You need to agree to continue.";
    if (Object.keys(l).length) return setLocal(l);

    const [firstName, ...rest] = name.split(/\s+/);
    setLocal({});
    setPending(true);
    const created = await signUp.create({
      firstName,
      lastName: rest.join(" ") || undefined,
      emailAddress,
      password,
      legalAccepted: true,
      unsafeMetadata: { company: companyName },
    });
    if (created.error) return setPending(false);
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) return setPending(false);
    setEmail(emailAddress);
    setCompany(companyName);
    setPending(false);
    setStep("verify");
  }

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    if (!code) return setLocal({ code: "Enter the code from your email." });
    setLocal({});
    setPending(true);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return setPending(false);
    if (signUp.status !== "complete") {
      setPending(false);
      return setLocal({ form: "Couldn't finish creating the account. Try again." });
    }
    await signUp.finalize();
    // The company becomes the workspace, which also resolves Clerk's
    // choose-organization task. If it fails, the task page takes over.
    try {
      const org = await createOrganization?.({ name: company });
      if (org) await clerk.setActive({ organization: org.id });
    } catch {
      /* handled by the onboarding step */
    }
    router.push(nextPathAfterAuth(clerk));
  }

  async function resend() {
    await signUp.verifications.sendEmailCode();
    setLocal({});
  }

  const nameError = local.name ?? errors.fields.firstName?.message ?? errors.fields.lastName?.message;
  const emailError = local.email ?? errors.fields.emailAddress?.message;
  const passwordError = local.password ?? errors.fields.password?.message;
  const codeError = local.code ?? errors.fields.code?.message;
  const termsError = local.terms ?? errors.fields.legalAccepted?.message;
  const formError = local.form ?? errors.global?.[0]?.message;

  if (step === "verify") {
    return (
      <form onSubmit={verify} noValidate className="flex flex-col gap-4.5">
        <p className="text-sm text-ink-muted">
          We sent a code to <span className="font-medium text-ink">{email}</span>. Enter it to finish.
        </p>
        <Field label="Code" htmlFor="su-code" error={codeError}>
          <Input id="su-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="font-mono tracking-[0.2em]" invalid={!!codeError} />
        </Field>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <Button type="submit" variant="primary" loading={pending} className="w-full">
          {pending ? "Creating your workspace…" : "Create account"}
        </Button>
        <button type="button" onClick={resend} className="self-center text-sm font-medium text-link hover:underline">
          Send a new code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={create} noValidate className="flex flex-col gap-4.5">
      <Field label="Full name" htmlFor="su-name" error={nameError}>
        <Input id="su-name" name="name" autoComplete="name" placeholder="Alex Morgan" invalid={!!nameError} />
      </Field>
      <Field label="Company" htmlFor="su-company" hint="This becomes your workspace name." error={local.company}>
        <Input id="su-company" name="company" autoComplete="organization" placeholder="Your MSP" invalid={!!local.company} />
      </Field>
      <Field label="Work email" htmlFor="su-email" error={emailError}>
        <Input id="su-email" name="email" type="email" autoComplete="email" placeholder="name@yourmsp.com" invalid={!!emailError} />
      </Field>
      <Field label="Password" htmlFor="su-password" hint="At least 8 characters." error={passwordError}>
        <PasswordInput id="su-password" name="password" autoComplete="new-password" invalid={!!passwordError} />
      </Field>
      <div>
        <label className="flex items-start gap-2.5 text-sm leading-5 text-ink-muted">
          <input type="checkbox" name="terms" value="yes" className="mt-0.5 size-4 shrink-0 accent-brand" aria-invalid={!!termsError || undefined} />
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
        {termsError && <p className="mt-1 text-label text-danger">{termsError}</p>}
      </div>
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <Button type="submit" variant="primary" loading={pending} className="w-full">
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
