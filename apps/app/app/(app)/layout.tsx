import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

/** Shell for every authenticated, org-scoped route. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="font-display text-lg font-semibold">Alevo</span>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/conversations" className="hover:text-foreground">
              Conversations
            </Link>
            <Link href="/settings/members" className="hover:text-foreground">
              Members
            </Link>
            <Link href="/settings/secrets" className="hover:text-foreground">
              Integrations
            </Link>
            <Link href="/settings/files" className="hover:text-foreground">
              Files
            </Link>
          </nav>
          <OrganizationSwitcher hidePersonal afterCreateOrganizationUrl="/dashboard" />
        </div>
        <UserButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
