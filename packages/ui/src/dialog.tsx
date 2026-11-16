"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "./cx";

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Called on Escape, backdrop click, or a cancel control inside. */
  onClose: () => void;
  children?: ReactNode;
  /** Action row, right-aligned. */
  footer?: ReactNode;
  /** An × in the top-right corner (for dialogs without a Cancel action). */
  showClose?: boolean;
  /** Panel width; `xl` for multi-pane dialogs (the account modal). */
  size?: "md" | "xl";
  /** No padding/heading — children own the whole panel (`title` becomes the
   *  accessible name). For shells like the two-pane account dialog. */
  bare?: boolean;
  /** Replaces the panel width (a `max-w-*` class): the Integrations dialogs size themselves. */
  panelClassName?: string;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [role="combobox"]:not([disabled])';

/**
 * Modal panel drawn on our own surface (never the browser's dialog chrome).
 * Locks page scroll, traps Tab inside, closes on Escape / backdrop click.
 */
export function Dialog({ open, title, description, onClose, children, footer, showClose, size = "md", bare, panelClassName }: Props) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first control so keyboard users land inside the panel.
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={bare ? title : undefined}
        aria-labelledby={bare ? undefined : titleId}
        aria-describedby={!bare && description ? descId : undefined}
        onKeyDown={onKeyDown}
        className={cx(
          "relative w-full overflow-hidden rounded-md border border-hairline bg-surface shadow-float",
          panelClassName ?? (size === "xl" ? "max-w-4xl" : "max-w-md"),
        )}
      >
        {!bare && (
          <>
            <div className="border-b border-hairline bg-sunken px-5 py-3.5 pr-12">
              <h2 id={titleId} className="font-display text-[16px] font-semibold leading-6 text-ink">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-[13.5px] leading-5 text-ink-muted">
                  {description}
                </p>
              )}
            </div>
            {children && <div className="px-5 py-4">{children}</div>}
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline bg-sunken px-5 py-3">{footer}</div>}
          </>
        )}
        {bare && children}
        {/* Last in the DOM so the first focus lands on the dialog's real
            controls; absolutely placed so it still sits top-right. */}
        {showClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-2.5 inline-flex size-8 items-center justify-center rounded-xs text-ink-muted transition-colors duration-150 ease-out hover:bg-raised hover:text-ink"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
