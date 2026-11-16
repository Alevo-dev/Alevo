"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { BrandMark } from "@/components/workspace/brand-mark";
import { cx } from "@/lib/cx";
import type { ServiceIcon } from "@/lib/integrations/services";
import type { Tone } from "@/lib/ui/status";

type Slots = { header: HTMLElement | null; footer: HTMLElement | null };
const SlotsContext = createContext<Slots>({ header: null, footer: null });
const CloseContext = createContext<() => void>(() => undefined);

/** Close the window once a save went through: pass the form's action state. Outside a dialog it does nothing. */
export function useCloseOnSave(state: { ok?: boolean }) {
  const close = useContext(CloseContext);
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
}

/** Panel widths of the board's dialogs: Slack-style 560, the website form 780, the chat widget 900. Others sit between. */
const WIDTH = { sm: "max-w-[560px]", md: "max-w-[680px]", lg: "max-w-[780px]", xl: "max-w-[900px]" } as const;
export type ToolDialogWidth = keyof typeof WIDTH;

/**
 * A tool's settings window, as in the Integrations boards: the brand mark, the name with its state pill and
 * a one-line subtitle, a close button; an optional tab row; the body; and a footer bar (a note and Done).
 * Content can put controls in the header's right side (`DialogHeaderRight`) and replace the footer (`DialogFooter`,
 * e.g. the unsaved-changes bar) from inside the body, so a form keeps all its state where it lives.
 */
export function ToolDialog({
  open,
  onClose,
  icon,
  title,
  status,
  subtitle,
  note,
  width = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  icon: ServiceIcon;
  title: string;
  status?: { label: string; tone: Tone };
  subtitle?: string;
  /** The footer's note beside Done. */
  note?: string;
  width?: ToolDialogWidth;
  children: ReactNode;
}) {
  // The two slots are set with stable state setters as refs (an inline ref callback would re-run every render).
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const slots = useMemo<Slots>(() => ({ header, footer }), [header, footer]);
  return (
    <Dialog open={open} onClose={onClose} title={title} bare panelClassName={cx("rounded-[12px]", WIDTH[width])}>
      <SlotsContext.Provider value={slots}>
        <CloseContext.Provider value={onClose}>
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <div className="flex items-center gap-3.5 px-6 pb-4 pt-5">
            <BrandMark icon={icon} />
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2.5 font-display text-[19px] font-semibold leading-6 text-ink">
                {title}
                {status && <Pill tone={status.tone}>{status.label}</Pill>}
              </h2>
              {subtitle && <p className="mt-0.5 text-[13.5px] leading-[19px] text-ink-muted">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span ref={setHeader} className="flex items-center gap-2" />
              <button
                type="button"
                aria-label="Close dialog"
                onClick={onClose}
                className="inline-flex size-8 items-center justify-center rounded-xs text-ink-muted transition-[background-color,transform] duration-150 ease-out hover:bg-raised hover:text-ink active:scale-95"
              >
                <X className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-5 overflow-auto border-t border-hairline px-6 py-5">{children}</div>
          <div ref={setFooter} className="group/ft border-t border-hairline bg-sunken">
            <div className="flex items-center gap-3 px-6 py-3 group-has-[[data-footer=custom]]/ft:hidden">
              {note && (
                <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
                  <Info className="size-3.5 shrink-0 text-success" strokeWidth={1.75} aria-hidden="true" />
                  {note}
                </span>
              )}
              <span className="flex-1" />
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        </div>
        </CloseContext.Provider>
      </SlotsContext.Provider>
    </Dialog>
  );
}

/** Controls for the header's right side (before the close button): the chat widget's on / off switch. */
export function DialogHeaderRight({ children }: { children: ReactNode }) {
  const { header } = useContext(SlotsContext);
  return header ? createPortal(children, header) : null;
}

/** Replaces the footer's note and Done while mounted: render it only while there is something to say (unsaved changes). */
export function DialogFooter({ children }: { children: ReactNode }) {
  const { footer } = useContext(SlotsContext);
  return footer
    ? createPortal(
        <div data-footer="custom" className="flex items-center gap-3 px-6 py-3">
          {children}
        </div>,
        footer,
      )
    : null;
}

/** The tab row under the header; it bleeds to the dialog's edges whatever the body padding. */
export function DialogTabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (key: string) => void }) {
  return (
    <div role="tablist" className="-mx-6 -mt-5 flex gap-[22px] border-b border-hairline px-6">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cx(
              "relative -mb-px cursor-pointer pb-2.5 pt-2 text-[14.5px] font-[550] outline-none transition-colors duration-150 ease-out focus-visible:[box-shadow:var(--ds-focus-ring)]",
              on ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[image:var(--ds-gradient-brand)]" : "text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
