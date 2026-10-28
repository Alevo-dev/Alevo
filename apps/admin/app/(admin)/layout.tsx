import { UserButton } from "@clerk/nextjs";
import { authInterrupt, requirePlatformAdmin } from "@alevo/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Brand } from "@/components/brand";
import { MobileMenu } from "@/components/mobile-menu";

export const dynamic = "force-dynamic";

/**
 * Gate the whole console on platform-admin. proxy.ts already requires a
 * session; a signed-in non-admin lands on app/forbidden.tsx (403), no session
 * or no mirrored user on app/unauthorized.tsx (401) — the shared Alevo screens.
 * The shell mirrors the product app: a left rail (brand + Admin pill, the
 * pages, theme, "Open the app" at the bottom) and a content column whose top
 * bar carries only the account button on desktop, burger + brand on phones.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    authInterrupt(error);
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between px-4 md:justify-end md:px-10">
          <div className="flex items-center gap-3 md:hidden">
            <MobileMenu />
            <Brand />
          </div>
          <UserButton />
        </header>
        <main className="min-w-0 flex-1 px-4 pb-6 md:px-10 md:pb-8">{children}</main>
      </div>
    </div>
  );
}
