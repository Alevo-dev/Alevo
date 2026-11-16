"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ToolDialog } from "@/components/workspace/tool-dialog";
import { dialogMeta } from "@/lib/integrations/dialog-meta";
import { Input } from "@/components/ui/field";
import { BrandMark } from "@/components/workspace/brand-mark";
import type { ServiceIcon } from "@/lib/integrations/services";

export type AddableTool = {
  id: string;
  name: string;
  icon: ServiceIcon;
  /** False for placeholders and platform services: listed, but not connectable here. */
  managed: boolean;
  /** Shown instead of "connect" when not managed, e.g. "Coming soon". */
  unavailable: string;
  dialogDescription?: string;
};

/**
 * One section as a panel (the board's panel): header bar with the title, hint and the add button,
 * the inline picker of the tools it can still take (searchable) right under it, then its rows.
 * Picking a tool opens that tool's settings dialog; once connected, the section lists it as a row.
 * No tools left to add (or a viewer): no button.
 */
export function ToolSection({
  id,
  title,
  hint,
  add,
  pick,
  tools,
  panels,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  /** The button: "Add booking tool". */
  add: string;
  /** The picker's heading: "Add a booking tool". */
  pick: string;
  /** Unconnected tools of this section; empty hides the button. */
  tools: AddableTool[];
  /** Each tool's settings panel, server-rendered, keyed by id. */
  panels: Record<string, ReactNode>;
  /** The rows. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? tools.find((t) => t.id === activeId) : undefined;
  const q = query.trim().toLowerCase();
  const shown = q ? tools.filter((t) => t.name.toLowerCase().includes(q)) : tools;

  return (
    <Card as="section" padding="none" id={id} aria-label={title} className="scroll-mt-6">
      <CardHeader
        title={title}
        hint={hint}
        aside={
          tools.length > 0 && (
            <Button aria-expanded={open} className={cx(open && "border-brand bg-brand-soft hover:bg-brand-soft")} onClick={() => setOpen((o) => !o)}>
              <Plus className="size-3.5 text-ink-muted" strokeWidth={2} aria-hidden="true" />
              {add}
            </Button>
          )
        }
      />

      {open && (
        <div className="border-b border-hairline bg-canvas px-3.5 py-3 motion-safe:animate-rise">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-ink">{pick}</p>
            <div className="w-[220px] max-w-full">
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools" aria-label="Search tools" />
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="mt-2.5 text-ink-muted">No tool matches.</p>
          ) : (
            <ul className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5">
              {shown.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={!t.managed}
                    onClick={() => {
                      setOpen(false);
                      setActiveId(t.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-xs border border-hairline bg-surface px-2 py-[5px] text-left text-[13.5px] font-[550] text-ink transition-colors enabled:hover:border-brand-sky enabled:hover:bg-brand-soft disabled:cursor-default"
                  >
                    <BrandMark icon={t.icon} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.managed ? (
                      <Plus className="size-3.5 shrink-0 text-brand-ink" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <span className="shrink-0 rounded-full border border-violet/60 px-1.5 text-[11px] leading-[15px] text-violet-ink">{t.unavailable}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {children}

      {active && (
        <ToolDialog open onClose={() => setActiveId(null)} icon={active.icon} title={active.name} {...dialogMeta(active.id, active.dialogDescription)}>
          {panels[active.id]}
        </ToolDialog>
      )}
    </Card>
  );
}
