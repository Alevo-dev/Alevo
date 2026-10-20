"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const TABS = [
  { href: "/workspace/profile", label: "Business profile" },
  { href: "/workspace/agent", label: "Agent" },
  { href: "/workspace/knowledge", label: "Knowledge" },
  { href: "/workspace/members", label: "Members" },
  { href: "/workspace/integrations", label: "Integrations" },
  { href: "/workspace/files", label: "Files" },
] as const;

export function WorkspaceTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace sections" className="mt-6 flex flex-wrap gap-x-6 border-b border-hairline">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              // The active underline is a pseudo-element sitting on the hairline, so
              // nothing overflows the nav (a negative margin here caused a scrollbar).
              "relative whitespace-nowrap py-3 text-sm no-underline transition-colors",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full",
              active ? "font-semibold text-ink after:bg-brand" : "font-medium text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
