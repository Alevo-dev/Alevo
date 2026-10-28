"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cx } from "@alevo/ui/cx";
import { ThemeToggle } from "@alevo/ui/theme-toggle";
import { AdminNav, OpenApp } from "./admin-nav";
import { Brand } from "./brand";

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
          "fixed left-0 top-0 z-50 flex h-dvh w-58 flex-col bg-canvas transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-4 py-4">
          <Brand />
          <button type="button" onClick={close} className="shrink-0 p-1" aria-label="Close menu">
            <X className="size-4 text-ink-muted" strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 py-4">
          <AdminNav onNavigate={close} />
        </div>
        <div className="mt-auto flex flex-col gap-4 border-t border-hairline px-4 py-4">
          <ThemeToggle />
          <OpenApp className="border-t border-hairline pt-4" />
        </div>
      </div>
    </>
  );
}
