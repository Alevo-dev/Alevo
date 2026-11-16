import { Skeleton, SkeletonPageHeader } from "@/components/ui/skeleton";

/** A section heading: title + hint over the hairline (the flat `Panel` / `CardHeader`). */
function Head({ delay, title = "w-36", hint = "w-44" }: { delay: number; title?: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-hairline pb-[9px]">
      <Skeleton className={`h-4 rounded-xs ${title}`} delay={delay} />
      <Skeleton className={`h-3 rounded-xs ${hint}`} delay={delay + 30} />
    </div>
  );
}

/**
 * Skeleton for the Operations pages (Dashboard, Conversations, Meetings): they share one layout, so they
 * share one loader. No cards, as on the pages: the title row, the strip of facts, the divided row of four
 * figures, two flat sections side by side, then a table section.
 */
export function OperationsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-5">
      <SkeletonPageHeader action />

      <div className="grid grid-cols-2 gap-y-2 border-y border-hairline py-2.5 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5 px-3.5 first:pl-0">
            <Skeleton className="h-2.5 w-16 rounded-xs" delay={100 + i * 50} />
            <Skeleton className="h-4 w-24 rounded-xs" delay={130 + i * 50} />
          </div>
        ))}
      </div>

      <section className="grid grid-cols-2 border-y border-hairline lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="relative min-h-[100px] border-l border-hairline px-4 py-3 first:border-l-0 first:pl-0 max-lg:nth-[odd]:border-l-0 max-lg:nth-[odd]:pl-0">
            <Skeleton className="h-3 w-20 rounded-xs" delay={220 + i * 70} />
            <Skeleton className="mt-1.5 h-[30px] w-16 rounded-xs" delay={260 + i * 70} />
            <Skeleton className="mt-2 h-3 w-28 rounded-xs" delay={300 + i * 70} />
            <div className="absolute bottom-3 right-3 flex h-[34px] items-end gap-[3px]">
              {[55, 70, 60, 90, 80, 65, 75].map((h, b) => (
                <Skeleton key={b} className="w-[5px] rounded-t-[2px]" delay={340 + i * 70 + b * 30} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {[0, 1].map((i) => (
          <div key={i}>
            <Head delay={520 + i * 60} />
            <Skeleton className="mt-3.5 h-40 w-full rounded-xs" delay={580 + i * 60} />
          </div>
        ))}
      </section>

      <section>
        <Head delay={700} title="w-28" hint="w-52" />
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-4 border-b border-hairline py-3.5">
            <Skeleton className="h-3 w-12 rounded-xs" delay={760 + row * 60} />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40 rounded-xs" delay={780 + row * 60} />
              <Skeleton className="h-3 w-24 rounded-xs" delay={800 + row * 60} />
            </div>
            <Skeleton className="ml-auto hidden h-3 w-20 rounded-xs sm:block" delay={820 + row * 60} />
            <Skeleton className="h-5 w-24 rounded-full" delay={840 + row * 60} />
          </div>
        ))}
      </section>
    </div>
  );
}
