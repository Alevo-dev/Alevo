"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { NavGroupList, NavLink } from "./app-sidebar";
import { PREFERENCES } from "./nav-items";

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
        className={`fixed left-0 top-0 z-50 h-dvh w-58 bg-rail transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
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

        <nav aria-label="Primary" className="flex flex-col overflow-y-auto px-2.5 py-3">
          <NavGroupList pathname={pathname} onNavigate={closeMenu} />
        </nav>

        <div className="mt-auto border-t border-hairline px-2.5 py-3 shrink-0">
          <NavLink item={PREFERENCES} pathname={pathname} onNavigate={closeMenu} />
        </div>
      </div>
    </>
  );
}
