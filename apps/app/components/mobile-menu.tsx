"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Building2, CalendarCheck, LayoutDashboard, MessagesSquare, Settings } from "lucide-react";
import { cx } from "@/lib/cx";
import { WorkspaceSubnav } from "./workspace-subnav";
import { WorkspaceSwitcher } from "./workspace-switcher";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/meetings", label: "Meetings", icon: CalendarCheck },
  { href: "/workspace/profile", label: "Workspace", icon: Building2, match: "/workspace" },
] as const;

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Burger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="size-5 text-ink" strokeWidth={2} />
        ) : (
          <Menu className="size-5 text-ink" strokeWidth={2} />
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Slide-out sidebar */}
      <div
        className={`fixed left-0 top-0 z-50 h-dvh w-58 bg-canvas transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            {/* Mounted only while open: the switcher runs Clerk's org list fetch
                and carries the Manage/Create dialogs — the desktop sidebar has
                its own copy, so a closed drawer must not run a second one. */}
            {isOpen && <WorkspaceSwitcher />}
          </div>
          <button
            onClick={closeMenu}
            className="p-1 shrink-0"
            aria-label="Close menu"
          >
            <X className="size-4 text-ink-muted" strokeWidth={2} />
          </button>
        </div>

        <nav aria-label="Primary" className="-mx-1 flex flex-col gap-1 px-1 py-4 shrink-0">
          {NAV.map(({ href, label, icon: Icon, ...item }) => {
            const base = "match" in item ? item.match : href;
            const active = pathname === base || pathname.startsWith(`${base}/`);
            return (
              <div key={href}>
                <Link
                  href={href}
                  onClick={closeMenu}
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
                {active && base === "/workspace" && <WorkspaceSubnav onNavigate={closeMenu} />}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-hairline px-4 py-4 shrink-0">
          <Link
            href="/preferences"
            onClick={closeMenu}
            aria-current={pathname === "/preferences" ? "page" : undefined}
            className={cx(
              "-mx-1 flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium no-underline transition-colors",
              pathname === "/preferences" ? "bg-brand-soft text-ink" : "text-ink-muted hover:bg-raised hover:text-ink",
            )}
          >
            <Settings className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Settings
          </Link>
        </div>
      </div>
    </>
  );
}
