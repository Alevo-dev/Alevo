"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronRight } from "lucide-react";
import { NAV_GROUPS, isActive } from "./nav-items";

/** Breadcrumb under the top bar: Console, then the page you are on (from the rail's labels). */
export function Crumbs() {
  const pathname = usePathname();
  const here = NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
  const deeper = here != null && pathname !== here.href;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 pb-1 text-label text-ink-muted">
      <Building2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      <Link href="/dashboard" className="font-medium text-ink-muted no-underline hover:text-ink hover:underline">
        Console
      </Link>
      {here && (
        <>
          <ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          {deeper ? (
            <Link href={here.href} className="font-medium text-ink-muted no-underline hover:text-ink hover:underline">
              {here.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-ink">
              {here.label}
            </span>
          )}
        </>
      )}
    </nav>
  );
}
