import type { Metadata } from "next";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AuthScreen } from "@/components/auth/auth-screen";
import { inviteFromSearchParams, type InviteSearchParams } from "@/components/auth/invite-params";
import { Spinner } from "@/components/ui/button";

export const metadata: Metadata = { title: "Create account" };

/** `/sign-up` renders the auth screen; `/sign-up/sso-callback` completes OAuth. */
export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ "sign-up"?: string[] }>;
  searchParams: Promise<InviteSearchParams>;
}) {
  const slug = (await params)["sign-up"]?.[0];
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
  return <AuthScreen initialMode="up" invite={invite} />;
}
