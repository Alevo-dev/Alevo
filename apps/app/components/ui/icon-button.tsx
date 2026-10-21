"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Spinner } from "./button";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** `danger` = red (remove/delete); `default` = muted neutral action. */
  tone?: "default" | "danger";
  loading?: boolean;
  /** The icon. Always pair with an `aria-label` — there's no visible text. */
  children: ReactNode;
};

/**
 * A compact icon-only button on a transparent background with a hover tint —
 * used for row actions like remove/delete (`tone="danger"` → red trash can).
 */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { tone = "default", loading, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger"
          ? "text-danger hover:bg-danger/10"
          : "text-ink-muted hover:bg-raised hover:text-ink",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  );
});
