"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/nav-kit";

export type IntegrationTab = { key: string; label: string; count?: number; content: ReactNode };

/** One tab per section; every panel stays mounted (open dialogs and typed text survive) and a `#booking`-style hash opens its tab. */
export function IntegrationTabs({ tabs }: { tabs: IntegrationTab[] }) {
  const [tab, setTab] = useState(tabs[0]!.key);
  useEffect(() => {
    const sync = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (tabs.some((t) => t.key === id)) setTab(id);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [tabs]);

  return (
    <div className="space-y-5">
      <Tabs label="Integrations" value={tab} options={tabs.map((t) => ({ key: t.key, label: t.label, count: t.count, onSelect: () => setTab(t.key) }))} />
      {tabs.map((t) => (
        <div key={t.key} hidden={tab !== t.key} className="space-y-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
