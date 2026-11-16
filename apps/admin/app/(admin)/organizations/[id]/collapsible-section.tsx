"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@alevo/ui/cx";

/** A flat section whose heading row opens and closes it; collapsed until opened. */
export function CollapsibleSection({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2.5 border-b border-hairline pb-[9px] text-left outline-none focus-visible:[box-shadow:var(--ds-focus-ring)]"
      >
        <ChevronDown className={cx("size-4 shrink-0 text-ink-muted transition-transform duration-150 ease-out motion-reduce:transition-none", !open && "-rotate-90")} strokeWidth={1.75} aria-hidden="true" />
        <h2 className="font-display text-[15px] font-semibold leading-5 text-ink">{title}</h2>
        {hint && <span className="text-label text-ink-muted">{hint}</span>}
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
