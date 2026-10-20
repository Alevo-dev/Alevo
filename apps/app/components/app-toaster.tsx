"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import type { CSSProperties } from "react";

/** Sonner reads these custom properties for its colours; we point them at the
 *  design tokens so toasts follow light/dark with the rest of the app. */
const TOKENS = {
  "--normal-bg": "var(--ds-surface)",
  "--normal-border": "var(--ds-hairline)",
  "--normal-text": "var(--ds-ink)",
  "--success-bg": "var(--ds-surface)",
  "--success-border": "var(--ds-success)",
  "--success-text": "var(--ds-ink)",
  "--error-bg": "var(--ds-surface)",
  "--error-border": "var(--ds-danger)",
  "--error-text": "var(--ds-ink)",
  "--warning-bg": "var(--ds-surface)",
  "--warning-border": "var(--ds-warning)",
  "--warning-text": "var(--ds-ink)",
  "--info-bg": "var(--ds-surface)",
  "--info-border": "var(--ds-brand)",
  "--info-text": "var(--ds-ink)",
  "--border-radius": "var(--ds-radius-md)",
} as CSSProperties;

/** App-wide toasts: bottom-right, 4s, closable, animated by Sonner. */
export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === "light" ? "light" : "dark"}
      duration={4000}
      closeButton
      gap={12}
      offset={24}
      style={TOKENS}
      toastOptions={{
        classNames: {
          toast: "font-sans shadow-float",
          title: "text-sm font-medium",
          description: "text-label text-ink-muted",
          // Tailwind v4 trailing `!` = important (Sonner positions its close button inline).
          closeButton:
            "left-auto! right-2! top-2! translate-x-0! translate-y-0! border-hairline! bg-surface! text-ink-muted! hover:bg-raised! hover:text-ink!",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-brand",
        },
      }}
    />
  );
}
