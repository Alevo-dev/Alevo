import { Skeleton, SkeletonPageHeader, SkeletonStatTile } from "@alevo/ui/skeleton";

/** Shown the instant the console loads, while the cross-org queries run. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <SkeletonPageHeader action />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonStatTile key={i} delay={80 + i * 60} chart={i < 4} hint={i === 4} />
        ))}
      </div>
      <div className="rounded-lg border border-hairline bg-surface">
        <div className="space-y-2 px-6 pt-6">
          <Skeleton className="h-5 w-56 rounded-sm" delay={400} />
          <Skeleton className="h-3 w-96 max-w-full rounded-sm" delay={440} />
        </div>
        <div className="mt-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-hairline px-6 py-3.5 last:border-b-0">
              <Skeleton className="h-3 w-40 rounded-sm" delay={480 + i * 70} />
              <Skeleton className="h-3 w-16 rounded-sm" delay={500 + i * 70} />
              <Skeleton className="ml-auto h-3 w-24 rounded-sm" delay={520 + i * 70} />
              <Skeleton className="h-5 w-24 rounded-full" delay={540 + i * 70} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
