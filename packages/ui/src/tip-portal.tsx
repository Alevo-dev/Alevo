"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";

/**
 * Draws a chart tooltip on `document.body`, positioned from its parent box, so a card's
 * `overflow: hidden` (tiles, tables) can never crop it. The parent is the chart's `relative`
 * box; `x` / `y` are fractions of it. Flips below the mark when there is no room above.
 */
export function TipPortal({ x, y, anchor, className, children }: { x: number; y: number; anchor: "start" | "center" | "end"; className?: string; children: ReactNode }) {
  const mark = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const box = mark.current?.parentElement?.getBoundingClientRect();
    if (!box) return;
    const top = box.top + y * box.height;
    const height = tip.current?.offsetHeight ?? 60;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measured from the DOM after layout
    setAt({ left: box.left + x * box.width, top, below: top - height - 10 < 4 });
  }, [x, y]);

  return (
    <>
      <span ref={mark} hidden />
      {createPortal(
        <div
          ref={tip}
          role="status"
          className={cx(
            "animate-rise pointer-events-none fixed z-[100] rounded-sm border border-control bg-raised px-3 py-2 text-xs leading-tight whitespace-nowrap shadow-float",
            anchor === "center" && "-translate-x-1/2",
            anchor === "end" && "-translate-x-full",
            at?.below ? "translate-y-[14px]" : "-translate-y-[calc(100%+10px)]",
            !at && "invisible",
            className,
          )}
          style={{ left: at?.left ?? 0, top: at?.top ?? 0 }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
