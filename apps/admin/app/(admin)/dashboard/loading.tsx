import { SkeletonPageHeader, SkeletonStatTile } from "@alevo/ui/skeleton";
import { TableSkeleton } from "@/components/table-skeleton";

/** Shown the instant the console loads, while the cross-org queries run. Flat, like the page. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <SkeletonPageHeader action />
      <div className="grid grid-cols-2 border-y border-hairline lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonStatTile key={i} delay={80 + i * 60} chart={i < 4} hint={i === 4} />
        ))}
      </div>
      <TableSkeleton rows={5} delay={400} />
    </div>
  );
}
