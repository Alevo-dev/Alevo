"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cx } from "@alevo/ui/cx";
import { NAV_GROUPS, isActive, type NavItem } from "./nav-items";

/** One rail row. The current page wears the brand gradient with a bar on its left edge (same as the app). */
function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative flex h-[34px] items-center gap-2.5 rounded-xs pl-2.5 pr-2 text-sm font-medium no-underline transition-colors duration-150",
        active
          ? "bg-[linear-gradient(100deg,color-mix(in_oklab,var(--ds-brand-sky)_36%,transparent),color-mix(in_oklab,var(--ds-accent-light)_40%,transparent))] font-semibold text-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ds-brand-sky)_45%,transparent)] before:absolute before:-left-[9px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-sm before:bg-[linear-gradient(180deg,var(--ds-brand-sky),var(--ds-accent-light))]"
          : "text-ink-muted hover:bg-surface hover:text-ink",
      )}
    >
      <Icon className={cx("size-4", active ? "text-ink" : "text-ink-muted")} strokeWidth={1.75} aria-hidden="true" />
      {item.label}
    </Link>
  );
}

/** The console's pages in collapsible groups, the current one highlighted. */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col">
      {NAV_GROUPS.map((g) => (
        <details key={g.id} open className="group mt-1">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xs px-2 py-1.5 text-[12px] font-semibold uppercase tracking-[0.07em] text-ink-muted [&::-webkit-details-marker]:hidden hover:text-ink">
            {g.label}
            <ChevronRight className="ml-auto size-3.5 transition-transform duration-150 group-open:rotate-90" strokeWidth={1.75} aria-hidden="true" />
          </summary>
          <div className="ml-[17px] flex flex-col gap-0.5 border-l border-hairline pl-2">
            {g.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        </details>
      ))}
    </nav>
  );
}
