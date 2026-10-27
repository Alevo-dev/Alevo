"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx } from "./cx";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribeNoop = () => () => {};

/** Segmented light / dark / system control. Renders neutral until mounted
 *  (the saved theme is only known on the client). `label` adds the "Theme: Dark"
 *  reading beside it (the app's sidebar); off, it is just the three buttons. */
export function ThemeToggle({ className, label = true }: { className?: string; label?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // false on the server render, true once hydrated — no effect + setState.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const current = mounted ? theme : undefined;
  // The theme actually applied right now; "System" resolves to the OS setting.
  const applied = mounted && resolvedTheme ? (resolvedTheme === "dark" ? "Dark" : "Light") : "…";
  const viaSystem = mounted && theme === "system";

  return (
    <div className={cx("flex items-center justify-between gap-0", className)}>
      {label && (
        <span className="text-label text-ink-muted" aria-live="polite">
          <span className="font-medium text-ink">Theme: {applied}</span>
          {viaSystem && " (system)"}
        </span>
      )}
      <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-sm border border-hairline bg-surface p-0.5">
        {OPTIONS.map(({ value, label: name, icon: Icon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={name}
              title={name}
              onClick={() => setTheme(value)}
              className={cx(
                "inline-flex size-8 items-center justify-center rounded-[6px] transition-colors",
                active ? "bg-brand-soft text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
