import { SkeletonPageHeader, SkeletonStatTile } from "@alevo/ui/skeleton";
import { TableSkeleton } from "@/components/table-skeleton";

/** Shown while the spend totals load. Flat, like the page. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <SkeletonPageHeader action />
      <div className="grid grid-cols-1 border-y border-hairline sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonStatTile key={i} delay={80 + i * 60} chart hint />
        ))}
      </div>
      <TableSkeleton rows={4} delay={300} />
    </div>
  );
}
