import type { Metadata } from "next";
import Image from "next/image";
import { SignIn } from "@clerk/nextjs";
import { Pill } from "@alevo/ui/pill";

export const metadata: Metadata = { title: "Sign in" };

/** Clerk's sign-in on the Alevo canvas: the mark, the console's name, the form. */
export default function SignInPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-canvas px-5 py-12 text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_20%,color-mix(in_oklab,var(--ds-brand)_18%,transparent),transparent_70%)]"
      />
      <div className="relative flex items-center gap-3">
        <Image src="/alevo-mark.png" alt="" width={32} height={32} priority className="size-8" />
        <span className="font-display text-xl font-semibold tracking-tight">Alevo</span>
        <Pill tone="violet">Admin</Pill>
      </div>
      <div className="relative animate-rise">
        <SignIn />
      </div>
      <p className="relative max-w-xs text-center text-label text-ink-muted">For Alevo staff. Workspace users sign in to the app instead.</p>
    </main>
  );
}
