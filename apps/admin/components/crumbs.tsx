"use client";

import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { Breadcrumb, type Crumb } from "@alevo/ui/breadcrumb";
import { NAV_GROUPS, isActive } from "./nav-items";

/** Breadcrumb under the top bar: Console, the page you are on, then the record you opened (an organization). */
export function Crumbs() {
  const pathname = usePathname();
  const here = NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));
  const trail: Crumb[] = [{ label: "Console", href: "/dashboard" }];
  if (here && here.href !== "/dashboard") {
    trail.push({ label: here.label, href: here.href });
    if (here.href === "/organizations" && pathname !== here.href) trail.push({ label: "Organization" });
  }
  return <Breadcrumb icon={<Building2 className="size-3.5" strokeWidth={1.75} />} items={trail} />;
}
