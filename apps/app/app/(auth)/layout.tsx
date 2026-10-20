import { AuthArt } from "@/components/auth/auth-art";

/** Split auth screen: curved brand art on the left, the form on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-canvas text-ink">
      <AuthArt />
      <section className="flex min-h-0 items-center justify-center px-5 py-10 md:ml-[50%] md:min-h-dvh md:px-16">
        {children}
      </section>
    </main>
  );
}
