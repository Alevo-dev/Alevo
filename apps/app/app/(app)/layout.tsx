import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

/** Shell for every authenticated, org-scoped route. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold">Alevo</span>
          <OrganizationSwitcher hidePersonal afterCreateOrganizationUrl="/dashboard" />
        </div>
        <UserButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
