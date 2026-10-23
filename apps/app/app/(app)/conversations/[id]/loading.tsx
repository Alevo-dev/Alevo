import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a conversation thread, laid out exactly like the page: the
 * messages column (back link, name + status line, pill, alternating bubbles
 * with a sender line above each, the reply box) and the lead-details aside
 * (fit-score ring, the details list, the "why the score" box).
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]"
    >
      <section className="flex min-w-0 flex-col gap-6">
        <header className="border-b border-hairline pb-5">
          <Skeleton className="h-3 w-24 rounded-sm" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-8 w-64 max-w-full rounded-sm" delay={60} />
              <div className="flex items-center gap-2">
                <Skeleton className="size-2 rounded-full" delay={100} />
                <Skeleton className="h-3.5 w-80 max-w-full rounded-sm" delay={100} />
              </div>
            </div>
            <Skeleton className="h-7 w-24 rounded-full" delay={140} />
          </div>
        </header>

        <ol className="flex flex-col gap-5">
          {[0, 1, 2, 3].map((i) => {
            const fromContact = i % 2 === 0;
            return (
              <li key={i} className={fromContact ? "flex w-full max-w-[720px] flex-col self-start" : "flex w-full max-w-[720px] flex-col items-end self-end"}>
                <Skeleton className="mb-1.5 h-3 w-36 rounded-sm" delay={220 + i * 110} />
                <Skeleton className={fromContact ? "h-16 w-4/5 rounded-md" : "h-24 w-11/12 rounded-md"} delay={250 + i * 110} />
              </li>
            );
          })}
        </ol>

        <div className="mt-auto flex flex-col gap-3 border-t border-hairline pt-6">
          <Skeleton className="h-24 w-full rounded-sm" delay={700} />
          <div className="flex justify-end">
            <Skeleton className="h-10 w-32 rounded-md" delay={760} />
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-6 lg:border-l lg:border-hairline lg:pl-6">
        <div className="flex items-center gap-5">
          <Skeleton className="size-24 shrink-0 rounded-full" delay={120} />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded-sm" delay={160} />
            <Skeleton className="h-7 w-16 rounded-sm" delay={190} />
          </div>
        </div>

        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="contents">
              <dt>
                <Skeleton className="h-3.5 w-16 rounded-sm" delay={300 + i * 70} />
              </dt>
              <dd>
                <Skeleton className="h-3.5 w-36 max-w-full rounded-sm" delay={330 + i * 70} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2 rounded-md border border-hairline p-4">
          <Skeleton className="h-3.5 w-28 rounded-sm" delay={640} />
          <Skeleton className="h-3 w-full rounded-sm" delay={680} />
          <Skeleton className="h-3 w-5/6 rounded-sm" delay={720} />
        </div>
      </aside>
    </div>
  );
}
