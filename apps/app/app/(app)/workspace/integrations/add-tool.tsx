"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cx } from "@/lib/cx";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { BrandMark } from "@/components/workspace/brand-mark";
import type { ServiceIcon } from "@/lib/integrations/services";
import { KEYS_DESCRIPTION } from "./manage-dialog";

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
 * One section's add control: a button in the section header that opens an inline picker
 * of the tools that section can still take (searchable). Picking one opens that tool's
 * settings dialog; once it is connected the section lists it as a row.
 */
export function AddTool({
  label,
  title,
  tools,
  panels,
}: {
  /** The button: "Add booking tool". */
  label: string;
  /** The picker's heading: "Add a booking tool". */
  title: string;
  tools: AddableTool[];
  /** Each tool's settings panel, server-rendered, keyed by id. */
  panels: Record<string, ReactNode>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? tools.find((t) => t.id === activeId) : undefined;
  const q = query.trim().toLowerCase();
  const shown = q ? tools.filter((t) => t.name.toLowerCase().includes(q)) : tools;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-2 text-label font-semibold text-link transition-colors",
          open ? "border-brand bg-brand-soft" : "border-control hover:border-brand hover:bg-surface",
        )}
      >
        <Plus className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
        {label}
      </button>

      {/* The picker is the next sibling of the header row, so it opens right under it. */}
      {open && (
        <div className="basis-full rounded-lg border border-hairline bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <div className="w-56 max-w-full">
              <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools" aria-label="Search tools" />
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No tool matches.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {shown.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={!t.managed}
                    onClick={() => {
                      setOpen(false);
                      setActiveId(t.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md border border-hairline px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors enabled:hover:border-brand enabled:hover:bg-brand-soft disabled:cursor-default disabled:text-ink-muted"
                  >
                    <BrandMark icon={t.icon} />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.managed ? (
                      <Plus className="size-3.5 shrink-0 text-link" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <span className="shrink-0 text-label">{t.unavailable}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {active && (
        <Dialog open onClose={() => setActiveId(null)} title={active.name} description={active.dialogDescription ?? KEYS_DESCRIPTION} size="xl">
          <div className="space-y-4">{panels[active.id]}</div>
        </Dialog>
      )}
    </>
  );
}
