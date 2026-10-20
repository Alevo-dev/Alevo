import type { Metadata } from "next";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = { title: "Create account" };

/** `/sign-up` renders the auth screen; `/sign-up/sso-callback` completes OAuth. */
export default async function SignUpPage({ params }: { params: Promise<{ "sign-up"?: string[] }> }) {
  const slug = (await params)["sign-up"]?.[0];
  if (slug === "sso-callback") {
    return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" />;
  }
  return <AuthScreen initialMode="up" />;
}
