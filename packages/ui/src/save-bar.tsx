"use client";

import { Check } from "lucide-react";
import { Button } from "./button";
import { cx } from "./cx";

/**
 * Save bar for a Workspace form (board `.savebar`): full width along the bottom of the
 * content, slides up while there are unsaved changes, carries the form-level error.
 * Render it inside the `<form>`.
 */
export function SaveBar({
  visible,
  pending,
  error,
  onDiscard,
}: {
  visible: boolean;
  pending?: boolean;
  error?: string | null;
  onDiscard: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      aria-hidden={!visible}
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-3 border-t border-control bg-topbar/95 px-6 py-3 backdrop-blur-sm md:left-[236px]",
        "shadow-[0_-10px_28px_rgb(0_0_0/0.4)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <span className="inline-flex items-center gap-2 font-[550] text-warning">
        <i className="size-[7px] rounded-full bg-warning" aria-hidden="true" />
        Unsaved changes
      </span>
      {error && <span className="text-label text-danger">{error}</span>}
      <span className="flex-1" />
      <button
        type="button"
        onClick={onDiscard}
        disabled={pending}
        tabIndex={visible ? 0 : -1}
        className="rounded-xs px-1.5 font-[550] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ds-focus-ring)] disabled:opacity-50"
      >
        Discard
      </button>
      <Button type="submit" variant="primary" loading={pending} tabIndex={visible ? 0 : -1}>
        {!pending && <Check className="size-3.5" aria-hidden="true" />}
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
