import { UserButton } from "@clerk/nextjs";
import { ForbiddenError, requirePlatformAdmin, UnauthorizedError } from "@alevo/auth";

export const dynamic = "force-dynamic";

/** Gate the whole console on platform-admin. proxy.ts already requires a session. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePlatformAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
          <div>
            <h1 className="text-xl">Not authorized</h1>
            <p className="mt-1 text-muted-foreground">
              This console is for Alevo platform admins.
            </p>
          </div>
          <UserButton />
        </main>
      );
    }
    throw error;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="font-display text-lg font-semibold">Alevo Admin</span>
        <UserButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
