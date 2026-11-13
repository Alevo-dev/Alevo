"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

/** The Workspace pages: shown as a sub-menu under "Workspace" in the side nav while you are in that section. */
export const WORKSPACE_PAGES = [
  { href: "/workspace/profile", label: "Profile" },
  { href: "/workspace/agent", label: "Agent" },
  { href: "/workspace/knowledge", label: "Knowledge" },
  { href: "/workspace/integrations", label: "Integrations" },
  { href: "/workspace/manage", label: "Manage" },
  { href: "/workspace/settings", label: "Settings" },
] as const;

export function WorkspaceSubnav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul aria-label="Workspace pages" className="ml-5 flex flex-col gap-0.5 border-l border-hairline pl-2">
      {WORKSPACE_PAGES.map((page) => {
        const active = pathname.startsWith(page.href);
        return (
          <li key={page.href}>
            <Link
              href={page.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "block rounded-sm px-3 py-1.5 text-sm no-underline transition-colors",
                active ? "bg-brand-soft font-medium text-ink" : "text-ink-muted hover:bg-raised hover:text-ink",
              )}
            >
              {page.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
