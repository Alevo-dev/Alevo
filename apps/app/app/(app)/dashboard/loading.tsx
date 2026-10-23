import { Skeleton, SkeletonPageHeader, SkeletonStatTile } from "@/components/ui/skeleton";

/**
 * Skeleton for the Dashboard, laid out like the page: title with its status
 * line, the four key-figure tiles, then "Recent activity" (time / name + meta /
 * status pill rows) beside "Where leads come from" (label + count, then a bar).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8">
      <SkeletonPageHeader />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonStatTile key={i} delay={140 + i * 70} hint={i % 2 === 1} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-hairline bg-surface p-6">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-36 rounded-sm" delay={420} />
            <Skeleton className="h-3.5 w-32 rounded-sm" delay={450} />
          </div>
          <div className="mt-2 divide-y divide-hairline">
            {[0, 1, 2, 3, 4, 5].map((row) => {
              const d = 500 + row * 70;
              return (
                <div key={row} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[132px_minmax(0,1fr)_auto]">
                  <Skeleton className="h-3 w-24 rounded-sm" delay={d} />
                  <Skeleton className="h-3.5 w-3/4 max-w-full rounded-sm" delay={d + 20} />
                  <Skeleton className="col-start-2 h-5 w-20 rounded-full sm:col-start-3" delay={d + 40} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-hairline bg-surface p-6">
          <Skeleton className="h-5 w-44 rounded-sm" delay={420} />
          <Skeleton className="mt-2 h-3 w-24 rounded-sm" delay={450} />
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3].map((i) => {
              const d = 520 + i * 90;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-3.5 w-16 rounded-sm" delay={d} />
                    <Skeleton className="h-3 w-14 rounded-sm" delay={d + 20} />
                  </div>
                  <Skeleton className="mt-2 h-2 w-full rounded-full" delay={d + 40} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
