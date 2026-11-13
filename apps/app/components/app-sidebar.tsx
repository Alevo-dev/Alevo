"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarCheck, LayoutDashboard, MessagesSquare, Settings } from "lucide-react";
import { cx } from "@/lib/cx";
import { WorkspaceSubnav } from "./workspace-subnav";
import { AgentStatus } from "./agent-status";
import { WorkspaceSwitcher } from "./workspace-switcher";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/meetings", label: "Meetings", icon: CalendarCheck },
  { href: "/workspace/profile", label: "Workspace", icon: Building2, match: "/workspace" },
] as const;

/** Settings sits where the theme control used to: bottom of the rail, above the agent status. */
function SettingsLink({ active }: { active: boolean }) {
  return (
    <Link
      href="/preferences"
      aria-current={active ? "page" : undefined}
      className={cx(
        "-mx-1 flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium no-underline transition-colors",
        active ? "bg-brand-soft text-ink" : "text-ink-muted hover:bg-raised hover:text-ink",
      )}
    >
      <Settings className={cx("size-4", active ? "text-brand" : "text-ink-muted")} strokeWidth={1.75} aria-hidden="true" />
      Settings
    </Link>
  );
}

/** Left rail on desktop, a stacked top bar on phones. */
export function AppSidebar({ agentOn }: { agentOn: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-hairline px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-58 md:border-b-0 md:border-r md:py-6">
      <div className="px-1">
        <WorkspaceSwitcher />
      </div>

      <nav aria-label="Primary" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col">
        {NAV.map(({ href, label, icon: Icon, ...item }) => {
          const base = "match" in item ? item.match : href;
          const active = pathname === base || pathname.startsWith(`${base}/`);
          return (
            <div key={href}>
              <Link
      href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex shrink-0 items-center gap-3 rounded-sm px-3 py-2.5 text-sm no-underline transition-colors",
                  active
                    ? "bg-brand-soft font-medium text-ink"
                    : "font-medium text-ink-muted hover:bg-raised hover:text-ink",
                )}
              >
                <Icon className={cx("size-4", active ? "text-brand" : "text-ink-muted")} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </Link>
              {active && base === "/workspace" && <WorkspaceSubnav />}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4 px-1 md:mt-auto">
        <SettingsLink active={pathname === "/preferences"} />
        <AgentStatus on={agentOn} className="border-t border-hairline pt-4" />
      </div>
    </aside>
  );
}
