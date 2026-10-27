import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { authInterrupt, requirePlatformAdmin } from "@alevo/auth";
import { Pill } from "@alevo/ui/pill";
import { ThemeToggle } from "@alevo/ui/theme-toggle";
import { APP_URL } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * Gate the whole console on platform-admin. proxy.ts already requires a
 * session; a signed-in non-admin lands on app/forbidden.tsx (403), no session
 * or no mirrored user on app/unauthorized.tsx (401) — the shared Alevo screens.
 * The shell mirrors the product app's top bar: mark + wordmark on the left,
 * theme + account on the right, content in the same gutters.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    authInterrupt(error);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-4 md:px-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3 text-ink no-underline">
            <Image src="/alevo-mark.png" alt="" width={28} height={28} priority className="size-7" />
            <span className="font-display text-lg font-semibold tracking-tight">Alevo</span>
          </Link>
          <Pill tone="violet">Admin</Pill>
          <nav aria-label="Console" className="ml-4 hidden items-center gap-1 sm:flex">
            <Link href="/dashboard" className="rounded-sm px-3 py-1.5 text-sm font-medium text-ink-muted no-underline transition-colors hover:text-ink">
              Overview
            </Link>
            <Link href="/settings" className="rounded-sm px-3 py-1.5 text-sm font-medium text-ink-muted no-underline transition-colors hover:text-ink">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <a href={APP_URL} className="hidden text-label text-ink-muted no-underline hover:text-ink sm:inline">
            Open the app
          </a>
          <ThemeToggle label={false} />
          <UserButton />
        </div>
      </header>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
