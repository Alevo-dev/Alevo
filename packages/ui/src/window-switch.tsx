import Link from "next/link";
import { cx } from "./cx";

/**
 * The one time-window control for a page: each option is a link that sets
 * `?window=` on `basePath`, so the server page re-queries and the choice
 * survives a refresh. Used by the app dashboard and the admin console.
 */
export function WindowSwitch({
  value,
  windows,
  basePath = "/dashboard",
}: {
  value: number;
  windows: readonly number[];
  basePath?: string;
}) {
  return (
    <nav aria-label="Time window" className="inline-flex items-center gap-0.5 rounded-full border border-control bg-surface p-0.5">
      {windows.map((days) => {
        const active = days === value;
        return (
          <Link
            key={days}
            href={`${basePath}?window=${days}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-full px-3 py-1.5 text-sm no-underline transition-colors",
              active ? "bg-brand-soft font-semibold text-ink" : "font-medium text-ink-muted hover:text-ink",
            )}
          >
            {days} days
          </Link>
        );
      })}
    </nav>
  );
}
