import {
  Bot,
  BookOpen,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  MessagesSquare,
  Plug,
  Settings,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; planned?: boolean };
export type NavGroup = { id: string; label: string; items: NavItem[] };

/** The rail's groups, in the boards' order. Outreach is shown as planned: no page behind it yet. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/conversations", label: "Conversations", icon: MessagesSquare },
      { href: "/meetings", label: "Meetings", icon: CalendarCheck },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { href: "/workspace/profile", label: "Profile", icon: Building2 },
      { href: "/workspace/agent", label: "Agent", icon: Bot },
      { href: "/workspace/knowledge", label: "Knowledge", icon: BookOpen },
      { href: "/workspace/integrations", label: "Integrations", icon: Plug },
      { href: "/workspace/manage", label: "Manage", icon: Users },
      { href: "/workspace/settings", label: "Brand", icon: SlidersHorizontal },
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    items: [{ href: "/prospecting", label: "Prospecting", icon: Users, planned: true }],
  },
];

/** Sits at the bottom of the rail: per-user preferences (theme, plan). */
export const PREFERENCES: NavItem = { href: "/preferences", label: "Preferences", icon: Settings };

/** Quick navigation's page list (planned pages left out). */
export const QUICK_PAGES = [
  ...NAV_GROUPS.flatMap((g) => g.items.filter((i) => !i.planned).map((i) => ({ href: i.href, label: i.label, group: g.label }))),
  { href: PREFERENCES.href, label: "Preferences", group: "Account" },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
