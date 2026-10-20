"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Called on Escape, backdrop click, or a cancel control inside. */
  onClose: () => void;
  children?: ReactNode;
  /** Action row, right-aligned. */
  footer?: ReactNode;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [role="combobox"]:not([disabled])';

/**
 * Modal panel drawn on our own surface (never the browser's dialog chrome).
 * Locks page scroll, traps Tab inside, closes on Escape / backdrop click.
 */
export function Dialog({ open, title, description, onClose, children, footer }: Props) {
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
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onKeyDown={onKeyDown}
        className="w-full max-w-md rounded-lg border border-hairline bg-surface p-6 shadow-float"
      >
        <h2 id={titleId} className="text-heading font-semibold text-ink">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-2 text-sm leading-5 text-ink-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-5">{children}</div>}
        {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
