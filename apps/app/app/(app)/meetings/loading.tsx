import { Skeleton, SkeletonPageHeader, SkeletonStatTile } from "@/components/ui/skeleton";

/**
 * Skeleton for Meetings, laid out like the page: title + context, the four
 * meeting-figure tiles, then the six-column table (contact, when, status pill,
 * source, outcome control, manage control right-aligned).
 */
const COLS = "grid-cols-[1.6fr_1.2fr_0.9fr_0.8fr_1fr_0.8fr]";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8">
      <SkeletonPageHeader />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonStatTile key={i} delay={140 + i * 70} hint={false} />
        ))}
      </section>

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        <div className={`grid ${COLS} gap-4 border-b border-hairline px-4 py-3`}>
          {["w-16", "w-24", "w-14", "w-14", "w-16", "w-14 justify-self-end"].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} rounded-sm`} delay={420 + i * 40} />
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((row) => {
          const d = 560 + row * 80;
          return (
            <div key={row} className={`grid ${COLS} items-center gap-4 border-b border-hairline px-4 py-3.5 last:border-b-0`}>
              <Skeleton className="h-3.5 w-36 max-w-full rounded-sm" delay={d} />
              <Skeleton className="h-3 w-32 max-w-full rounded-sm" delay={d + 20} />
              <Skeleton className="h-5 w-20 rounded-full" delay={d + 40} />
              <Skeleton className="h-3.5 w-14 rounded-sm" delay={d + 60} />
              <Skeleton className="h-9 w-full max-w-32 rounded-sm" delay={d + 80} />
              <Skeleton className="h-9 w-20 justify-self-end rounded-sm" delay={d + 100} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
