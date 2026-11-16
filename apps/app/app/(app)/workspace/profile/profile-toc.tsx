"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

export type TocItem = { id: string; label: string; done: boolean };

/** "On this page" (board `.toc`): sticky, the section in view is highlighted, a green dot marks a finished one. */
export function ProfileToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) (en.isIntersecting ? seen.add(en.target.id) : seen.delete(en.target.id));
        const first = items.find((i) => seen.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    for (const i of items) {
      const el = document.getElementById(i.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="sticky top-16 flex flex-col gap-0.5 border-l border-hairline/60 pl-3.5 text-[13.5px] max-[980px]:hidden">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-ink-muted">On this page</div>
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          aria-current={active === i.id ? "location" : undefined}
          className={cx(
            "rounded-xs py-[3px] outline-none transition-colors duration-150 focus-visible:[box-shadow:var(--ds-focus-ring)]",
            active === i.id ? "font-[550] text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          <span
            aria-hidden="true"
            className={cx("mr-2 inline-block size-1.5 rounded-full", i.done ? "bg-success" : active === i.id ? "bg-brand" : "bg-control")}
          />
          {i.label}
          {i.done && <span className="sr-only"> (done)</span>}
        </a>
      ))}
    </nav>
  );
}
