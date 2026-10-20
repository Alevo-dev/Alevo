"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { CalendarCheck, LayoutDashboard, MessagesSquare, Settings } from "lucide-react";
import { cx } from "@/lib/cx";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/meetings", label: "Meetings", icon: CalendarCheck },
  { href: "/settings/qualifier", label: "Settings", icon: Settings, match: "/settings" },
] as const;

export type PlanCard = { name: string; renews: string | null } | null;

/** Left rail on desktop, a stacked top bar on phones. */
export function AppSidebar({ plan }: { plan: PlanCard }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-hairline px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-[232px] md:border-b-0 md:border-r md:py-6">
      <Link href="/dashboard" className="flex items-center gap-3 px-2 text-ink no-underline">
        <Image src="/alevo-mark.png" alt="" width={28} height={28} priority className="size-7" />
        <span className="font-display text-lg font-semibold tracking-tight">Alevo</span>
      </Link>

      <nav aria-label="Primary" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col">
        {NAV.map(({ href, label, icon: Icon, ...item }) => {
          const base = "match" in item ? item.match : href;
          const active = pathname === base || pathname.startsWith(`${base}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-sm no-underline transition-colors",
                active
                  ? "bg-brand-soft font-medium text-ink"
                  : "font-medium text-ink-muted hover:bg-raised hover:text-ink",
              )}
            >
              <Icon className={cx("size-4", active ? "text-brand" : "text-ink-muted")} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      {plan && (
        <div className="hidden rounded-md border border-hairline bg-surface p-4 md:block">
          <div className="text-label text-ink-muted">Plan</div>
          <div className="mt-1 text-sm font-semibold text-ink">{plan.name}</div>
          {plan.renews && <div className="mt-3 text-label text-ink-muted">Renews {plan.renews}</div>}
        </div>
      )}

      <div className="flex flex-col gap-4 px-1 md:mt-auto">
        <ThemeToggle />
        <OrganizationSwitcher hidePersonal afterCreateOrganizationUrl="/dashboard" />
      </div>
    </aside>
  );
}
