import { cx } from "@/lib/cx";

/**
 * Route-level skeleton for every app page: Next shows it the instant a
 * navigation starts, while the page's data streams in. The shell (sidebar, top
 * bar) stays put — only the content column swaps. Blocks are shaped like the
 * pages (title, stat tiles, a table) and shimmer with a staggered sweep
 * (`.skeleton` in globals.css; still under reduced-motion).
 */
function Block({ className, delay = 0 }: { className: string; delay?: number }) {
  return <div className={cx("skeleton", className)} style={{ animationDelay: `${delay}ms` }} />;
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8 pt-2">
      <div className="space-y-3">
        <Block className="h-8 w-56 rounded-sm" />
        <Block className="h-4 w-80 max-w-full rounded-sm" delay={80} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-lg border border-hairline bg-surface p-4">
            <Block className="h-3 w-24 rounded-sm" delay={120 + i * 90} />
            <Block className="h-9 w-20 rounded-sm" delay={160 + i * 90} />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3">
          <Block className="h-3 w-40 rounded-sm" delay={400} />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hairline px-4 py-3.5 last:border-b-0">
            <Block className="size-8 shrink-0 rounded-full" delay={460 + i * 70} />
            <Block className="h-3 w-40 rounded-sm" delay={480 + i * 70} />
            <Block className="ml-auto h-5 w-20 rounded-full" delay={500 + i * 70} />
            <Block className="hidden h-3 w-24 rounded-sm sm:block" delay={520 + i * 70} />
          </div>
        ))}
      </div>
    </div>
  );
}
