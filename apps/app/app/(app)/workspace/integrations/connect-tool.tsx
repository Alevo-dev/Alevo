"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { BrandMark } from "@/components/workspace/brand-mark";
import type { ServiceGroup, ServiceIcon } from "@/lib/integrations/services";
import { KEYS_DESCRIPTION } from "./manage-dialog";

export type ConnectableTool = {
  id: string;
  group: ServiceGroup;
  name: string;
  hint: string;
  icon: ServiceIcon;
  /** False for platform services and placeholders: shown, but not connectable here. */
  managed: boolean;
  /** What to say instead of a Connect button when `managed` is false. */
  unavailable: string;
  dialogDescription?: string;
};

type Props = {
  groups: { id: ServiceGroup; title: string }[];
  tools: ConnectableTool[];
  /** Each tool's settings panel, server-rendered, keyed by id. */
  panels: Record<string, ReactNode>;
};

/**
 * "Connect a tool": a picker listing every tool that isn't on the page yet,
 * in the same sections as the page. Picking one closes the picker and opens
 * that tool's settings dialog; once it is connected the page lists it.
 */
export function ConnectTool({ groups, tools, panels }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? tools.find((t) => t.id === activeId) : undefined;

  return (
    <>
      <Button type="button" variant="primary" onClick={() => setPickerOpen(true)} disabled={tools.length === 0}>
        Connect a tool
      </Button>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} title="Connect a tool" description="Pick a service. Its settings open next." size="xl" showClose>
        <div className="space-y-6">
          {groups.map((group) => {
            const rows = tools.filter((t) => t.group === group.id);
            if (rows.length === 0) return null;
            return (
              <section key={group.id} aria-label={group.title}>
                <h3 className="text-label font-semibold text-ink-muted">{group.title}</h3>
                <ul className="mt-2 divide-y divide-hairline">
                  {rows.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <BrandMark icon={t.icon} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{t.name}</p>
                          <p className="text-label text-ink-muted">{t.hint}</p>
                        </div>
                      </div>
                      {t.managed ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setPickerOpen(false);
                            setActiveId(t.id);
                          }}
                        >
                          Connect
                        </Button>
                      ) : (
                        <Pill tone="muted">{t.unavailable}</Pill>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Dialog>

      {active && (
        <Dialog open onClose={() => setActiveId(null)} title={active.name} description={active.dialogDescription ?? KEYS_DESCRIPTION} size="xl">
          <div className="space-y-4">{panels[active.id]}</div>
        </Dialog>
      )}
    </>
  );
}
