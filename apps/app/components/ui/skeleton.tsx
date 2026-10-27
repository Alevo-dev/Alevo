import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";

/**
 * One shimmering placeholder block (`.skeleton` in globals.css). Size it with
 * classes; `delay` (ms) staggers the sweep so blocks ripple down the page.
 * Used by the route-level `loading.tsx` files.
 */
export function Skeleton({
  className,
  delay = 0,
  style,
}: {
  className: string;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("skeleton", className)}
      style={{ ...style, animationDelay: `${delay}ms` }}
    />
  );
}

/** Placeholder for `PageHeader`: title + one-line context, optional action on the right. */
export function SkeletonPageHeader({
  action = false,
  delay = 0,
}: {
  action?: boolean;
  delay?: number;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-sm" delay={delay} />
        <div className="flex items-center gap-2">
          <Skeleton className="size-2 rounded-full" delay={delay + 60} />
          <Skeleton
            className="h-3.5 w-72 max-w-full rounded-sm"
            delay={delay + 60}
          />
        </div>
      </div>
      {action && (
        <Skeleton className="h-10 w-40 rounded-md" delay={delay + 120} />
      )}
    </header>
  );
}

/** Placeholder for `StatTile`: label, the big number, an optional hint line,
 *  and with `chart` the row of mini bars the dashboard tiles carry. */
export function SkeletonStatTile({
  delay = 0,
  hint = true,
  chart = false,
}: {
  delay?: number;
  hint?: boolean;
  chart?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-md border border-hairline bg-surface p-4",
        chart && "flex min-h-[132px] flex-col justify-between",
      )}
    >
      <div>
        <Skeleton className="h-3 w-24 rounded-sm" delay={delay} />
        <Skeleton className="mt-2 h-9 w-20 rounded-sm" delay={delay + 40} />
        {hint && (
          <Skeleton className="mt-2 h-3 w-28 rounded-sm" delay={delay + 80} />
        )}
      </div>
      {chart && (
        <div className="mt-3.5 flex h-[30px] items-end gap-1">
          {[55, 70, 60, 90, 80, 65, 75].map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-[3px]"
              delay={delay + 100 + i * 40}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
