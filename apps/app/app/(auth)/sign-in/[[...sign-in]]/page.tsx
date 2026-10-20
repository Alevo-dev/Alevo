import type { Metadata } from "next";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AuthScreen } from "@/components/auth/auth-screen";
import { inviteFromSearchParams, type InviteSearchParams } from "@/components/auth/invite-params";
import { Spinner } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign in" };

/** `/sign-in` renders the auth screen; `/sign-in/sso-callback` completes OAuth. */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ "sign-in"?: string[] }>;
  searchParams: Promise<InviteSearchParams>;
}) {
  const slug = (await params)["sign-in"]?.[0];
  const invite = inviteFromSearchParams(await searchParams);
  if (slug === "sso-callback") {
    return (
      <div className="flex flex-col items-center gap-4 text-sm text-ink-muted">
        <Spinner />
        Finishing sign-in…
        {/* Clerk may run bot protection while transferring a new OAuth user to sign-up. */}
        <div id="clerk-captcha" />
        <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" />
      </div>
    );
  }
  return <AuthScreen initialMode="in" invite={invite} />;
}
