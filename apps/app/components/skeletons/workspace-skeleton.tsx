import { Skeleton, SkeletonPageHeader } from "@/components/ui/skeleton";

/**
 * Skeleton for the Workspace pages (Profile, Agent, Knowledge, Integrations, Manage, Brand): the title
 * row, a row of tabs, then flat sections: a heading over its hairline and label-left / control-right
 * rows. No cards, as on the pages.
 */
export function WorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <SkeletonPageHeader />

      <div className="flex gap-1 border-b border-hairline">
        {[56, 72, 84, 96].map((w, i) => (
          <div key={i} className="px-3 py-2.5">
            <Skeleton className="h-4 rounded-xs" style={{ width: w }} delay={60 + i * 50} />
          </div>
        ))}
      </div>

      {[0, 1].map((section) => {
        const base = 260 + section * 260;
        return (
          <section key={section}>
            <div className="flex items-baseline gap-3 border-b border-hairline pb-[9px]">
              <Skeleton className="h-4 w-40 rounded-xs" delay={base} />
              <Skeleton className="h-3 w-64 max-w-full rounded-xs" delay={base + 30} />
            </div>
            {[0, 1, 2].map((row) => {
              const d = base + 80 + row * 70;
              return (
                <div key={row} className="grid gap-3 border-b border-hairline py-3.5 last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)] md:items-center">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-32 rounded-xs" delay={d} />
                    <Skeleton className="h-3 w-44 max-w-full rounded-xs" delay={d + 30} />
                  </div>
                  <Skeleton className="h-8 w-full max-w-[28rem] rounded-xs" delay={d + 60} />
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
