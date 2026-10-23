import { Skeleton, SkeletonPageHeader } from "@/components/ui/skeleton";

/**
 * Skeleton for the Conversations list, laid out like the page: the title row
 * (title + count on the left, the lead-form button on the right) and the
 * five-column table (contact with a second line, channel, status pill, score
 * right-aligned, received). The thread page has its own `[id]/loading.tsx`.
 */
const COLUMNS = ["w-20", "w-16", "w-14", "w-12", "w-24"];

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8">
      <SkeletonPageHeader action />

      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        <div className="grid grid-cols-[2fr_1fr_1fr_0.6fr_1.4fr] gap-4 border-b border-hairline px-4 py-3">
          {COLUMNS.map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} rounded-sm ${i === 3 ? "justify-self-end" : ""}`} delay={180 + i * 40} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((row) => {
          const d = 320 + row * 80;
          return (
            <div key={row} className="grid grid-cols-[2fr_1fr_1fr_0.6fr_1.4fr] items-center gap-4 border-b border-hairline px-4 py-3.5 last:border-b-0">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40 max-w-full rounded-sm" delay={d} />
                <Skeleton className="h-3 w-28 max-w-full rounded-sm" delay={d + 20} />
              </div>
              <Skeleton className="h-3.5 w-14 rounded-sm" delay={d + 40} />
              <Skeleton className="h-5 w-20 rounded-full" delay={d + 60} />
              <Skeleton className="h-3.5 w-8 justify-self-end rounded-sm" delay={d + 80} />
              <Skeleton className="h-3 w-28 rounded-sm" delay={d + 100} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
