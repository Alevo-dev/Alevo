"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

/** The top bar's search: a plain GET to the organizations list (`?q=`). `/` focuses it from anywhere that is not a text field. */
export function OrgSearch() {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      action="/organizations"
      role="search"
      noValidate
      className="flex h-[30px] items-center gap-2 rounded-xs border border-hairline bg-sunken px-2.5 text-ink-muted focus-within:border-brand"
    >
      <Search className="size-[15px] shrink-0" strokeWidth={2} aria-hidden="true" />
      <input
        ref={input}
        name="q"
        type="text"
        placeholder="Search organizations"
        aria-label="Search organizations"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none! shadow-none! placeholder:text-ink-muted"
      />
      <kbd className="rounded-[4px] border border-hairline bg-canvas px-[5px] font-mono text-[11.5px] leading-4 text-ink-muted" aria-hidden="true">
        /
      </kbd>
    </form>
  );
}
