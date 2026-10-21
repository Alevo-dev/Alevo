"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn, useSignUp, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { nextPathAfterAuth } from "./after-auth";
import { GoogleMark } from "./google-mark";
import { PasswordInput } from "./password-input";

/** `__clerk_status` on the invite redirect: what Clerk needs from the invitee. */
export type InviteStatus = "sign_up" | "sign_in" | "complete";
export type Invite = { ticket: string; status: InviteStatus };

type Clerk = ReturnType<typeof useClerk>;
type Local = { name?: string; password?: string; form?: string };

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
  const { signIn, errors: signInErrors } = useSignIn();
  const { signUp, errors: signUpErrors } = useSignUp();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const [local, setLocal] = useState<Local>({});
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const completed = useRef(false);

  // Already signed in (active session): do NOT re-authenticate with the ticket —
  // `signIn.create({ strategy: "ticket" })` errors "you're already signed in".
  // The invitation is in this user's pending list, so send them to the
  // org-selection step to accept it. Covers both `complete` and `sign_in`
  // statuses whenever a session is already active.
  useEffect(() => {
    if (!isSignedIn || completed.current) return;
    completed.current = true;
    router.replace("/onboarding/choose-organization");
  }, [isSignedIn, router]);

  async function joinExisting() {
    setPending(true);
    setLocal({});
    const { error } = await signIn.create({ strategy: "ticket", ticket: invite.ticket });
    if (error) return setPending(false);
    if (signIn.status !== "complete") {
      setPending(false);
      return setLocal({ form: "This invite link can't be used to sign in. Ask for a new one." });
    }
    await signIn.finalize();
    router.push(await enterInvitedWorkspace(clerk));
  }

  async function joinNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const l: Local = {};
    if (!name) l.name = "Enter your name.";
    if (!password) l.password = "Choose a password.";
    if (l.name || l.password) return setLocal(l);

    const [firstName, ...rest] = name.split(/\s+/);
    setPending(true);
    setLocal({});
    const { error } = await signUp.create({
      strategy: "ticket",
      ticket: invite.ticket,
      firstName,
      lastName: rest.join(" ") || undefined,
      password,
    });
    if (error) return setPending(false);
    if (signUp.status !== "complete") {
      setPending(false);
      return setLocal({ form: "Couldn't finish creating your account from this invite. Ask for a new link." });
    }
    await signUp.finalize();
    router.push(await enterInvitedWorkspace(clerk));
  }

  /**
   * Google for a new invitee: a normal Google sign-up (the ticket can't ride
   * along), landing on the workspace step, where the pending invitation for
   * that email is listed to accept. Clerk matches invitations by email.
   */
  async function joinWithGoogle() {
    setGooglePending(true);
    setLocal({});
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/onboarding/choose-organization",
      redirectCallbackUrl: "/sign-up/sso-callback",
    });
    if (error) setGooglePending(false);
  }

  const nameError = local.name ?? signUpErrors.fields.firstName?.message ?? signUpErrors.fields.lastName?.message;
  const passwordError = local.password ?? signUpErrors.fields.password?.message;
  const formError =
    local.form ?? signInErrors.global?.[0]?.message ?? signUpErrors.global?.[0]?.message;

  // Don't flash the ticket UI before we know the session state; an active
  // session is redirected to the org-selection step by the effect above.
  if (!userLoaded || isSignedIn) {
    return <p className="text-sm text-ink-muted">Opening your workspace…</p>;
  }

  if (invite.status === "sign_in") {
    return (
      <div className="flex flex-col gap-4.5">
        <p className="text-sm text-ink-muted">You already have an Alevo account. Join with it to accept the invitation.</p>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <Button variant="primary" onClick={joinExisting} loading={pending} className="w-full">
          {pending ? "Joining…" : "Join the workspace"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={joinNew} noValidate className="flex flex-col gap-4.5">
      <p className="text-sm text-ink-muted">Your email is already verified by the invitation. Just add a name and a password.</p>
      <Field label="Full name" htmlFor="inv-name" error={nameError}>
        <Input id="inv-name" name="name" autoComplete="name" placeholder="Alex Morgan" invalid={!!nameError} />
      </Field>
      <Field label="Password" htmlFor="inv-password" hint="At least 8 characters." error={passwordError}>
        <PasswordInput id="inv-password" name="password" autoComplete="new-password" invalid={!!passwordError} />
      </Field>
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <div id="clerk-captcha" />
      <Button type="submit" variant="primary" loading={pending} disabled={googlePending} className="w-full">
        {pending ? "Joining…" : "Create account and join"}
      </Button>
      <div className="flex items-center gap-3 text-label text-ink-muted">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <Button variant="secondary" onClick={joinWithGoogle} loading={googlePending} disabled={pending} className="w-full">
        {!googlePending && <GoogleMark />}
        Continue with Google
      </Button>
      <p className="-mt-2 text-center text-label text-ink-muted">Use the Google account for the email the invite was sent to.</p>
    </form>
  );
}
