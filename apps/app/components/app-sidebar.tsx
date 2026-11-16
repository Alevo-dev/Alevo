"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cx } from "@/lib/cx";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { NAV_GROUPS, PREFERENCES, isActive, type NavItem } from "./nav-items";

/** One rail row. The current page wears the brand gradient with a bar on its left edge. */
export function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  const active = !item.planned && isActive(pathname, item.href);
  const base =
    "relative flex h-[34px] items-center gap-2.5 rounded-xs pl-2.5 pr-2 text-sm font-medium no-underline transition-colors duration-150";

  if (item.planned) {
    return (
      <span className={cx(base, "cursor-default text-ink-muted")}>
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
        {item.label}
        <span className="ml-auto rounded-full border border-violet px-1.5 text-[11px] font-semibold leading-[15px] text-violet-light">Planned</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        base,
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

/** Collapsible group: an uppercase label that opens and closes its links. */
export function NavGroupList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
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
    </>
  );
}

/** Left rail on desktop (the phone gets the same links in `MobileMenu`). */
export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-[46px] flex h-[calc(100dvh-46px)] w-[236px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-hairline bg-rail px-2.5 pb-4 pt-3">
      <div className="mb-2">
        <WorkspaceSwitcher />
      </div>
      <nav aria-label="Primary" className="flex flex-col">
        <NavGroupList pathname={pathname} />
      </nav>
      <div className="mt-auto pt-2.5">
        <NavLink item={PREFERENCES} pathname={pathname} />
      </div>
    </aside>
  );
}
