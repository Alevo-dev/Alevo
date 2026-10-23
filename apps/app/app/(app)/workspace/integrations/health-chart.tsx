"use client";

import { cx } from "@/lib/cx";
import type { HealthBucket } from "@/lib/integrations/health";

/**
 * Webhook outcomes per hour, last 24 hours: one column per hour, ok deliveries
 * in brand blue with failures stacked on top in danger red (the colour-blind
 * safe pair; a 2px surface gap and the stacking order carry the split too).
 * Column height is traffic, so a quiet hour is simply an empty slot — nothing
 * is interpolated. Hover a column for the exact figures.
 */
export function HealthChart({ buckets }: { buckets: HealthBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.ok + b.failed));
  const hour = new Intl.DateTimeFormat(undefined, { hour: "numeric" });

  return (
    <div className="flex flex-1 flex-col justify-end">
      <div className="flex h-28 items-end gap-1 border-b border-hairline" role="img" aria-label="Webhook deliveries per hour, ok and failed, over the last 24 hours">
        {buckets.map((b, i) => {
          const total = b.ok + b.failed;
          const from = new Date(b.at);
          const to = new Date(b.at + 3_600_000);
          const label = `${hour.format(from)}–${hour.format(to)}: ${b.ok} ok, ${b.failed} failed`;
          return (
            <div key={b.at} className="group relative flex h-full flex-1 flex-col justify-end" tabIndex={total ? 0 : -1} aria-label={label}>
              {/* Tooltip: the exact figures for this hour. */}
              {total > 0 && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-hairline bg-raised px-2 py-1 text-label text-ink shadow-float group-hover:block group-focus-visible:block"
                >
                  {label}
                </div>
              )}
              <div
                className="mx-auto flex w-full max-w-6 flex-col justify-end animate-grow-y"
                style={{ height: `${(total / max) * 100}%`, animationDelay: `${i * 30}ms` }}
              >
                {b.failed > 0 && (
                  <div
                    className={cx("w-full rounded-t-[4px] bg-danger", b.ok > 0 && "mb-0.5")}
                    style={{ flexBasis: `${(b.failed / Math.max(total, 1)) * 100}%` }}
                  />
                )}
                {b.ok > 0 && (
                  <div className={cx("w-full flex-1 bg-brand", b.failed === 0 && "rounded-t-[4px]")} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-label text-ink-muted">
        <span>24h ago</span>
        <span className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
            ok
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
            failed
          </span>
        </span>
        <span>now</span>
      </div>
    </div>
  );
}
