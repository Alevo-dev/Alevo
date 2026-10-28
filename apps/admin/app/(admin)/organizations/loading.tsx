import { SkeletonPageHeader } from "@alevo/ui/skeleton";
import { TableSkeleton } from "@/components/table-skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <SkeletonPageHeader />
      <TableSkeleton rows={10} delay={120} />
    </div>
  );
}
