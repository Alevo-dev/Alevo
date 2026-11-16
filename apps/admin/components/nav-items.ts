import { Activity, Building2, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { id: string; label: string; items: NavItem[] };

/** The console's rail, in the board's order: the console's pages, then the platform's own settings. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "console",
    label: "Console",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/organizations", label: "Organizations", icon: Building2 },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  { id: "platform", label: "Platform", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
