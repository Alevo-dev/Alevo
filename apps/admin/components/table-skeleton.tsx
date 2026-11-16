import { Skeleton } from "@alevo/ui/skeleton";

/** Placeholder rows while a list page's query runs: flat, hairlines only, no card. */
export function TableSkeleton({ rows = 8, delay = 0 }: { rows?: number; delay?: number }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 border-b border-hairline pb-[9px]">
        <Skeleton className="h-4 w-36 rounded-xs" delay={delay} />
        <Skeleton className="h-3 w-52 rounded-xs" delay={delay + 30} />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-hairline py-3.5">
          <Skeleton className="h-3 w-28 rounded-xs" delay={delay + i * 60} />
          <Skeleton className="h-3 w-40 rounded-xs" delay={delay + 20 + i * 60} />
          <Skeleton className="ml-auto h-3 w-24 rounded-xs" delay={delay + 40 + i * 60} />
          <Skeleton className="h-5 w-20 rounded-full" delay={delay + 60 + i * 60} />
        </div>
      ))}
    </div>
  );
}
