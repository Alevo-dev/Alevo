"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Select } from "./select";

/** "Today" for one day, "7 days" for more: the menu's option text. */
const optionLabel = (days: number) => (days === 1 ? "Today" : `${days} days`);

/**
 * The one time-window control for a page: "Last: [Today ▾]". Picking an option
 * (or pressing Alt+1, Alt+2… for the 1st, 2nd… option) sets `?window=` on
 * `basePath`, so the server page re-queries and the choice survives a refresh.
 * Used by the app dashboard and the admin console.
 */
export function WindowSwitch({
  value,
  windows,
  basePath,
  persistKey,
}: {
  value: number;
  windows: readonly number[];
  basePath?: string;
  /** Cookie name: the choice is saved there (one year) and the page refreshes, instead of `?window=`. */
  persistKey?: string;
}) {
  const router = useRouter();
  const current = usePathname();
  const path = basePath ?? current;
  const go = (days: number) => {
    if (days === value) return;
    if (persistKey) {
      document.cookie = `${persistKey}=${days}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    } else router.push(`${path}?window=${days}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
      const days = n ? windows[Number(n) - 1] : undefined;
      if (days === undefined) return;
      // On macOS Alt+digit types a character; leave text fields alone.
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t?.tagName ?? "")) return;
      e.preventDefault();
      go(days);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <Select
      size="sm"
      inline
      variant="menu"
      prefix="Last:"
      aria-label="Last: time window"
      value={String(value)}
      onChange={(v) => go(Number(v))}
      options={windows.map((d, i) => ({ value: String(d), label: optionLabel(d), hint: `Alt+${i + 1}` }))}
    />
  );
}
