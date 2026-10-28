import { Skeleton } from "@alevo/ui/skeleton";

/** A card of placeholder rows while a list page's query runs. */
export function TableSkeleton({ rows = 8, delay = 0 }: { rows?: number; delay?: number }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-hairline px-6 py-3.5 last:border-b-0">
          <Skeleton className="h-3 w-28 rounded-sm" delay={delay + i * 60} />
          <Skeleton className="h-3 w-40 rounded-sm" delay={delay + 20 + i * 60} />
          <Skeleton className="ml-auto h-3 w-24 rounded-sm" delay={delay + 40 + i * 60} />
          <Skeleton className="h-5 w-20 rounded-full" delay={delay + 60 + i * 60} />
        </div>
      ))}
    </div>
  );
}
