"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, ExternalLink, LayoutDashboard, Settings } from "lucide-react";
import { cx } from "@alevo/ui/cx";
import { APP_URL } from "@/lib/app-url";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/** The console's pages, one link each, the current one highlighted. Same look as the app's rail. */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="-mx-1 flex flex-col gap-1 px-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-sm no-underline transition-colors",
              active ? "bg-brand-soft font-medium text-ink" : "font-medium text-ink-muted hover:bg-raised hover:text-ink",
            )}
          >
            <Icon className={cx("size-4", active ? "text-brand" : "text-ink-muted")} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom of the rail, where the app keeps its agent status: the way back to the product. */
export function OpenApp({ className }: { className?: string }) {
  return (
    <a
      href={APP_URL}
      className={cx("flex items-center justify-between gap-3 text-label font-medium text-ink no-underline hover:text-brand", className)}
    >
      Open the app
      <ExternalLink className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
