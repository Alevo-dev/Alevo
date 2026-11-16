import { authInterrupt, requirePlatformAdmin } from "@alevo/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Crumbs } from "@/components/crumbs";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

/**
 * Gate the whole console on platform-admin. proxy.ts already requires a
 * session; a signed-in non-admin lands on app/forbidden.tsx (403), no session
 * or no mirrored user on app/unauthorized.tsx (401) — the shared Alevo screens.
 * The shell mirrors the product app: a full-width top bar (brand + Console chip,
 * org search, "Open the app", Platform admin chip, account), then the rail and
 * the content with its breadcrumb.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    authInterrupt(error);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <div className="flex min-w-0 flex-1">
        <div className="hidden md:flex">
          <AdminSidebar />
        </div>
        <main className="min-w-0 flex-1 px-4 pb-6 pt-4 md:px-5 md:pb-8">
          <Crumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
