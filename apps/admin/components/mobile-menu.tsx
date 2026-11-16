"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cx } from "@alevo/ui/cx";
import { ThemeToggle } from "@alevo/ui/theme-toggle";
import { AdminNav } from "./admin-nav";

/** Burger + slide-out drawer on phones, carrying the same rail as the desktop sidebar. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} className="md:hidden" aria-label="Toggle menu" aria-expanded={open}>
        {open ? <X className="size-5 text-ink" strokeWidth={2} /> : <Menu className="size-5 text-ink" strokeWidth={2} />}
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={close} aria-hidden="true" />}

      <div
        className={cx(
          "fixed left-0 top-0 z-50 flex h-dvh w-58 flex-col bg-rail transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-end border-b border-hairline px-4 py-3">
          <button type="button" onClick={close} className="shrink-0 p-1" aria-label="Close menu">
            <X className="size-4 text-ink-muted" strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-2.5 py-3">
          <AdminNav onNavigate={close} />
        </div>
        <div className="mt-auto border-t border-hairline px-2.5 py-3">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
