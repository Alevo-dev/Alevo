"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui/nav-kit";
import { cx } from "@/lib/cx";

/** The state dot beside a section in "On this page": set up (green), needs attention (amber), nothing yet (grey). */
export type SectionDot = "ok" | "warn" | "none";
export type IntegrationTab = { key: string; label: string; count?: number; dot: SectionDot; content: ReactNode };

const DOT: Record<SectionDot, string> = { ok: "bg-success", warn: "bg-warning", none: "bg-control" };

/**
 * One tab per section, with the board's "On this page" list beside them (a dot per section, the one open is
 * highlighted). Every panel stays mounted (open dialogs and typed text survive) and a `#booking`-style hash, from a
 * jump link or from the list, opens its tab.
 */
export function IntegrationTabs({ tabs }: { tabs: IntegrationTab[] }) {
  const [tab, setTab] = useState(tabs[0]!.key);
  useEffect(() => {
    const sync = () => {
      // `#communication` opens a section; `#communication:slack` opens it too (its window is opened by the row).
      const id = decodeURIComponent(location.hash.slice(1)).split(":")[0]!;
      if (tabs.some((t) => t.key === id)) setTab(id);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [tabs]);

  return (
    <div className="grid items-start gap-10 min-[981px]:grid-cols-[minmax(0,1fr)_168px]">
      <div className="min-w-0 space-y-5">
        <Tabs label="Integrations" value={tab} options={tabs.map((t) => ({ key: t.key, label: t.label, count: t.count, onSelect: () => setTab(t.key) }))} />
        {tabs.map((t) => (
          <div key={t.key} hidden={tab !== t.key} className="space-y-5">
            {t.content}
          </div>
        ))}
      </div>
      <nav aria-label="On this page" className="sticky top-16 flex flex-col gap-0.5 border-l border-hairline/60 pl-3.5 text-[13.5px] max-[980px]:hidden">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">On this page</div>
        {tabs.map((t) => {
          const on = t.key === tab;
          return (
            <a
              key={t.key}
              href={`#${t.key}`}
              onClick={() => setTab(t.key)}
              aria-current={on ? "location" : undefined}
              className={cx(
                "rounded-xs py-[3px] outline-none transition-colors duration-150 focus-visible:[box-shadow:var(--ds-focus-ring)]",
                on ? "font-[550] text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              <span aria-hidden="true" className={cx("mr-2 inline-block size-1.5 rounded-full", t.dot === "none" && on ? "bg-brand" : DOT[t.dot])} />
              {t.label}
              {t.dot !== "none" && <span className="sr-only">{t.dot === "ok" ? " (set up)" : " (needs attention)"}</span>}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
