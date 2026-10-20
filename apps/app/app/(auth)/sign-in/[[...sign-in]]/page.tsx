import type { Metadata } from "next";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = { title: "Sign in" };

/** `/sign-in` renders the auth screen; `/sign-in/sso-callback` completes OAuth. */
export default async function SignInPage({ params }: { params: Promise<{ "sign-in"?: string[] }> }) {
  const slug = (await params)["sign-in"]?.[0];
  if (slug === "sso-callback") {
    return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" />;
  }
  return <AuthScreen initialMode="in" />;
}
