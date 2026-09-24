"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CtaButton } from "@/components/marketing/cta-button";
import { mainNav, appLinks } from "@/lib/site";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-(--dur)",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav
        className="container-page flex items-center justify-between"
        style={{ height: "var(--header-h)" }}
        aria-label="Primary"
      >
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {mainNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <a
            href={appLinks.login}
            className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </a>
          <CtaButton href="signup" size="md">
            Get started
          </CtaButton>
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-full text-foreground md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

    </header>

      {/* Mobile menu — full-screen solid overlay. Rendered as a sibling of
          <header> so the header's backdrop-filter (on scroll) can't become the
          containing block for this fixed element. */}
      {open ? (
        <div className="fixed inset-0 z-70 flex h-dvh flex-col bg-background md:hidden">
          <div
            className="container-page flex shrink-0 items-center justify-between border-b border-border"
            style={{ height: "var(--header-h)" }}
          >
            <Logo />
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full text-foreground"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="container-page flex flex-1 flex-col gap-2 overflow-y-auto py-6">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-lg font-medium hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 flex items-center justify-between">
              <ThemeToggle />
              <a
                href={appLinks.login}
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-muted-foreground"
              >
                Log in
              </a>
            </div>
            <CtaButton href="signup" className="mt-2 w-full">
              Get started
            </CtaButton>
          </div>
        </div>
      ) : null}
    </>
  );
}
