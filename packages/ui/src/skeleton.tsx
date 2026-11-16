import type { CSSProperties } from "react";
import { cx } from "./cx";

/**
 * One shimmering placeholder block (`.skeleton` in theme.css). Size it with
 * classes; `delay` (ms) staggers the sweep so blocks ripple down the page.
 * Used by the route-level `loading.tsx` files.
 */
export function Skeleton({ className, delay = 0, style }: { className: string; delay?: number; style?: CSSProperties }) {
  return <div className={cx("skeleton", className)} style={{ ...style, animationDelay: `${delay}ms` }} />;
}

/** Placeholder for `PageHeader`: title + one-line context, optional action on the right. */
export function SkeletonPageHeader({ action = false, delay = 0 }: { action?: boolean; delay?: number }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-3 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-7 w-56 rounded-xs" delay={delay} />
        <Skeleton className="h-3.5 w-72 max-w-full rounded-xs" delay={delay + 60} />
      </div>
      {action && <Skeleton className="h-8 w-32 rounded-xs" delay={delay + 120} />}
    </header>
  );
}

/** Placeholder for `StatTile`: label, the big number, an optional hint line,
 *  and with `chart` the row of mini bars the dashboard tiles carry. */
export function SkeletonStatTile({ delay = 0, hint = true, chart = false }: { delay?: number; hint?: boolean; chart?: boolean }) {
  return (
    <div className={cx("rounded-sm border border-hairline bg-surface px-3.5 py-3", chart && "relative min-h-[78px]")}>
      <div>
        <Skeleton className="h-3 w-24 rounded-sm" delay={delay} />
        <Skeleton className="mt-1 h-[34px] w-20 rounded-xs" delay={delay + 40} />
        {hint && <Skeleton className="mt-2 h-3 w-28 rounded-sm" delay={delay + 80} />}
      </div>
      {chart && (
        <div className="absolute bottom-3 right-3 flex h-[34px] items-end gap-[3px]">
          {[55, 70, 60, 90, 80, 65, 75].map((h, i) => (
            <Skeleton key={i} className="w-[5px] rounded-t-[2px]" delay={delay + 100 + i * 40} style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}
