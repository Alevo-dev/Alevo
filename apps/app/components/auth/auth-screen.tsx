"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { toFormErrors } from "./clerk-errors";
import { ForgotPasswordForm } from "./forgot-password-form";
import { GoogleMark } from "./google-mark";
import { InviteJoin, type Invite } from "./invite-join";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

export type AuthMode = "in" | "up";
type View = AuthMode | "forgot";

const COPY: Record<View, { title: string; blurb: string }> = {
  in: { title: "Welcome back", blurb: "Sign in to see today's leads and meetings." },
  up: { title: "Create your account", blurb: "Set up Alevo for your MSP in a few minutes." },
  forgot: { title: "Reset your password", blurb: "We'll email you a one-time code." },
};

/**
 * Right half of the auth screen. One component serves /sign-in and /sign-up:
 * the tabs switch views in place (the URL is updated without a reload) and
 * the panel fades + rises on each switch.
 */
export function AuthScreen({ initialMode, invite }: { initialMode: AuthMode; invite?: Invite }) {
  const [view, setView] = useState<View>(initialMode);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const mode: AuthMode = view === "up" ? "up" : "in";

  // Tabs switch without a navigation, so keep the browser tab title in step.
  useEffect(() => {
    document.title = `${mode === "up" ? "Create account" : "Sign in"} | Alevo`;
  }, [mode]);

  const go = (next: View) => {
    setView(next);
    setOauthError(null);
    const path = next === "up" ? "/sign-up" : "/sign-in";
    if (location.pathname !== path) window.history.replaceState(null, "", path);
  };

  async function google() {
    const params = {
      strategy: "oauth_google" as const,
      redirectUrl: mode === "up" ? "/sign-up/sso-callback" : "/sign-in/sso-callback",
      redirectUrlComplete: "/dashboard",
    };
    setOauthPending(true);
    setOauthError(null);
    try {
      if (mode === "up") await signUp?.authenticateWithRedirect(params);
      else await signIn?.authenticateWithRedirect(params);
      // On success the browser is navigating to Google; keep the spinner.
    } catch (err) {
      setOauthPending(false);
      setOauthError(toFormErrors(err).form ?? "Couldn't start Google sign-in.");
    }
  }

  const logo = (
    <div className="mb-10 flex items-center gap-3">
      <Image src="/alevo-mark.png" alt="" width={32} height={32} className="size-8" />
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Alevo</span>
    </div>
  );

  // Arrived from an invitation email: redeem the ticket instead of the tabs.
  if (invite) {
    return (
      <div className="w-full max-w-[400px]">
        {logo}
        <h1 className="text-title font-semibold text-ink">You&apos;re invited</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">
          A teammate invited you to their Alevo workspace.
        </p>
        <div className="mt-7">
          <InviteJoin invite={invite} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      {logo}

      <div role="tablist" aria-label="Account" className="relative grid grid-cols-2 border-b border-hairline">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`auth-tab-${m}`}
            aria-selected={mode === m}
            aria-controls="auth-panel"
            onClick={() => go(m)}
            className={cx(
              "py-3 text-center text-[15px] font-medium transition-colors",
              mode === m ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
        <span
          aria-hidden="true"
          className="absolute -bottom-px h-0.5 w-1/2 rounded-full bg-brand transition-[left] duration-350 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
          style={{ left: mode === "in" ? "0%" : "50%" }}
        />
      </div>

      {/* Re-keyed per view so the enter animation replays on every switch. */}
      <div key={view} id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`} className="animate-rise mt-8">
        <h1 className="text-title font-semibold text-ink">{COPY[view].title}</h1>
        <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">{COPY[view].blurb}</p>
        <div className="mt-7">
          {view === "in" && <SignInForm onForgot={() => setView("forgot")} />}
          {view === "up" && <SignUpForm />}
          {view === "forgot" && <ForgotPasswordForm onBack={() => setView("in")} />}
        </div>
      </div>

      {/* Clerk's bot protection (Smart CAPTCHA) renders into this element when it
          needs to — on signUp.create and on Google sign-up from either tab. It
          must exist in the DOM before those calls, so it lives here, not in a form. */}
      <div id="clerk-captcha" className="mt-4 empty:mt-0" />

      {view !== "forgot" && (
        <>
          <div className="my-7 flex items-center gap-3 text-label text-ink-muted">
            <span className="h-px flex-1 bg-hairline" />
            or
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <Button variant="secondary" onClick={google} loading={oauthPending} disabled={!signIn || !signUp} className="w-full">
            {!oauthPending && <GoogleMark />}
            Continue with Google
          </Button>
          {oauthError && <p className="mt-2 text-sm text-danger">{oauthError}</p>}
        </>
      )}

      <p className="mt-7 text-center text-sm text-ink-muted">
        {mode === "in" ? (
          <>
            New to Alevo?{" "}
            <button type="button" onClick={() => go("up")} className="font-medium text-link hover:underline">
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => go("in")} className="font-medium text-link hover:underline">
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
