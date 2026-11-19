"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { Breadcrumb, type Crumb } from "@alevo/ui/breadcrumb";
import { NAV_GROUPS, PREFERENCES, isActive } from "./nav-items";

type Tail = { set: (items: Crumb[]) => void; items: Crumb[] };
const TailContext = createContext<Tail>({ set: () => {}, items: [] });

/** Wraps the shell so a page can name the record it shows (see CrumbTail). */
export function CrumbsProvider({ children }: { children: ReactNode }) {
  const [items, set] = useState<Crumb[]>([]);
  return <TailContext value={{ items, set }}>{children}</TailContext>;
}

/**
 * A page below a rail page renders this with the real trail beneath it, e.g. a conversation thread:
 * the client (a link back to them), then "Conversation". Until it mounts the breadcrumb shows a plain label.
 */
export function CrumbTail({ items }: { items: Crumb[] }) {
  const { set } = useContext(TailContext);
  const key = JSON.stringify(items);
  useEffect(() => {
    set(JSON.parse(key) as Crumb[]);
    return () => set([]);
  }, [key, set]);
  return null;
}

/** Used until a page names its record: /conversations/client/<id> is a client, /conversations/<id> a thread. */
function plainLabel(rest: string[]): string | null {
  if (rest.length === 0) return null;
  return rest[0] === "client" ? "Client" : "Conversation";
}

/**
 * Breadcrumb under the top bar: workspace, the rail's section (Workspace pages only: Operations would just repeat
 * the first step), the page, then the record you opened. Every step but the last links back to its level.
 * With more than three steps, the workspace name is hidden and the home icon links to the dashboard instead.
 */
export function Crumbs({ org }: { org: string }) {
  const pathname = usePathname();
  const { items: tail } = useContext(TailContext);
  const groups = [...NAV_GROUPS, { id: "account", label: "Account", items: [PREFERENCES] }];
  const group = groups.find((g) => g.items.some((i) => !i.planned && isActive(pathname, i.href)));
  const here = group?.items.find((i) => !i.planned && isActive(pathname, i.href));

  const trail: Crumb[] = [{ label: org, href: "/dashboard" }];
  if (here && group) {
    if (group.id === "workspace") trail.push({ label: group.label, href: group.items[0]?.href });
    trail.push({ label: here.label, href: here.href });
    const rest = pathname.slice(here.href.length).split("/").filter(Boolean);
    if (rest.length > 0) {
      if (tail.length > 0) trail.push(...tail);
      else trail.push({ label: plainLabel(rest) ?? "" });
    }
  }
  // The dashboard is the workspace link already: don't show "Acme > Dashboard" as two steps for the same page.
  if (trail.length === 2 && trail[1]?.href === "/dashboard") trail.pop();
  return <Breadcrumb icon={<Home className="size-3.5" strokeWidth={1.75} />} items={trail} />;
}
