"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn, useSignUp, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { nextPathAfterAuth } from "./after-auth";
import { toFormErrors, type FormErrors } from "./clerk-errors";
import { GoogleMark } from "./google-mark";
import { PasswordInput } from "./password-input";

const NONE: FormErrors = { fields: {} };

/** `__clerk_status` on the invite redirect: what Clerk needs from the invitee. */
export type InviteStatus = "sign_up" | "sign_in" | "complete";
export type Invite = { ticket: string; status: InviteStatus };

type Clerk = ReturnType<typeof useClerk>;

/**
 * Accepting the invite adds the membership; the session is still pending
 * (organization selection is forced), so activate the workspace they were
 * just invited to — the newest membership — and go on from there.
 */
async function enterInvitedWorkspace(clerk: Clerk): Promise<string> {
  await clerk.user?.reload();
  const newest = [...(clerk.user?.organizationMemberships ?? [])].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  )[0];
  if (newest) await clerk.setActive({ organization: newest.organization.id });
  return nextPathAfterAuth(clerk);
}

/**
 * Redeems an organization-invitation ticket from Clerk's invite email:
 * - `sign_up`: the invitee has no account yet → name + password, then join
 * - `sign_in`: they have an account but aren't signed in → one click to join
 * - `complete`: they were already signed in; Clerk accepted it → open it
 */
export function InviteJoin({ invite }: { invite: Invite }) {
  const router = useRouter();
  const clerk = useClerk();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveFromSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } = useSignUp();
  const { isSignedIn } = useUser();
  const [errors, setErrors] = useState<FormErrors>(NONE);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const completed = useRef(false);

  // Already signed in when the invite was accepted: just open the workspace.
  useEffect(() => {
    if (invite.status !== "complete" || !isSignedIn || completed.current) return;
    completed.current = true;
    enterInvitedWorkspace(clerk)
      .then((path) => router.push(path))
      .catch((err) => setErrors(toFormErrors(err)));
  }, [invite.status, isSignedIn, clerk, router]);

  async function joinExisting() {
    if (!signInLoaded) return;
    setPending(true);
    setErrors(NONE);
    try {
      const res = await signIn.create({ strategy: "ticket", ticket: invite.ticket });
      if (res.status !== "complete") throw new Error("This invite link can't be used to sign in. Ask for a new one.");
      await setActiveFromSignIn({ session: res.createdSessionId });
      router.push(await enterInvitedWorkspace(clerk));
    } catch (err) {
      setErrors(toFormErrors(err));
      setPending(false);
    }
  }

  async function joinNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!signUpLoaded) return;
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const fields: FormErrors["fields"] = {};
    if (!name) fields.name = "Enter your name.";
    if (!password) fields.password = "Choose a password.";
    if (fields.name || fields.password) return setErrors({ fields });

    const [firstName, ...rest] = name.split(/\s+/);
    setPending(true);
    setErrors(NONE);
    try {
      const res = await signUp.create({
        strategy: "ticket",
        ticket: invite.ticket,
        firstName,
        lastName: rest.join(" ") || undefined,
        password,
      });
      if (res.status !== "complete") throw new Error("Couldn't finish creating your account from this invite. Ask for a new link.");
      await setActiveFromSignUp({ session: res.createdSessionId });
      router.push(await enterInvitedWorkspace(clerk));
    } catch (err) {
      setErrors(toFormErrors(err));
      setPending(false);
    }
  }

  /**
   * Google for a new invitee: a normal Google sign-up (the ticket can't ride
   * along), landing on the workspace step, where the pending invitation for
   * that email is listed to accept. Clerk matches invitations by email.
   */
  async function joinWithGoogle() {
    if (!signUpLoaded) return;
    setGooglePending(true);
    setErrors(NONE);
    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sign-up/sso-callback",
        redirectUrlComplete: "/onboarding/choose-organization",
      });
    } catch (err) {
      setGooglePending(false);
      setErrors(toFormErrors(err));
    }
  }

  if (invite.status === "complete") {
    return (
      <div className="flex flex-col gap-4">
        {errors.form ? <Notice tone="danger">{errors.form}</Notice> : <p className="text-sm text-ink-muted">Opening your new workspace…</p>}
        {errors.form && (
          <Button variant="primary" onClick={() => router.push("/dashboard")} className="w-full">
            Go to the dashboard
          </Button>
        )}
      </div>
    );
  }

  if (invite.status === "sign_in") {
    return (
      <div className="flex flex-col gap-[18px]">
        <p className="text-sm text-ink-muted">You already have an Alevo account. Join with it to accept the invitation.</p>
        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
        <Button variant="primary" onClick={joinExisting} loading={pending} disabled={!signInLoaded} className="w-full">
          {pending ? "Joining…" : "Join the workspace"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={joinNew} noValidate className="flex flex-col gap-[18px]">
      <p className="text-sm text-ink-muted">Your email is already verified by the invitation. Just add a name and a password.</p>
      <Field label="Full name" htmlFor="inv-name" error={errors.fields.name}>
        <Input id="inv-name" name="name" autoComplete="name" placeholder="Alex Morgan" invalid={!!errors.fields.name} />
      </Field>
      <Field label="Password" htmlFor="inv-password" hint="At least 8 characters." error={errors.fields.password}>
        <PasswordInput id="inv-password" name="password" autoComplete="new-password" invalid={!!errors.fields.password} />
      </Field>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <div id="clerk-captcha" />
      <Button type="submit" variant="primary" loading={pending} disabled={!signUpLoaded || googlePending} className="w-full">
        {pending ? "Joining…" : "Create account and join"}
      </Button>
      <div className="flex items-center gap-3 text-label text-ink-muted">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <Button variant="secondary" onClick={joinWithGoogle} loading={googlePending} disabled={!signUpLoaded || pending} className="w-full">
        {!googlePending && <GoogleMark />}
        Continue with Google
      </Button>
      <p className="-mt-2 text-center text-label text-ink-muted">Use the Google account for the email the invite was sent to.</p>
    </form>
  );
}
