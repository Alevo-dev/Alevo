"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { NAV_GROUPS, PREFERENCES, isActive } from "./nav-items";

/** Breadcrumb under the top bar: the workspace, then the page you are on (from the rail's labels). */
export function Crumbs({ org }: { org: string }) {
  const pathname = usePathname();
  const items = [...NAV_GROUPS.flatMap((g) => g.items), PREFERENCES];
  const here = items.find((i) => !i.planned && isActive(pathname, i.href));
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 pb-1 text-label text-ink-muted">
      <Home className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      <Link href="/dashboard" className="font-medium text-ink-muted no-underline hover:text-ink hover:underline">
        {org}
      </Link>
      {here && (
        <>
          <ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span aria-current="page" className="font-medium text-ink">
            {here.label}
          </span>
        </>
      )}
    </nav>
  );
}
