import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the top-level app pages (Dashboard, Conversations, Meetings):
 * Next shows it the instant a navigation starts, while the page's data
 * streams in. The shell (sidebar, top bar) stays put — only the content column
 * swaps. Nested routes (Workspace tabs, a conversation) have their own
 * `loading.tsx`, because a boundary only covers the segment it lives in.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8 pt-2">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 rounded-sm" />
        <Skeleton className="h-4 w-80 max-w-full rounded-sm" delay={80} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-lg border border-hairline bg-surface p-4">
            <Skeleton className="h-3 w-24 rounded-sm" delay={120 + i * 90} />
            <Skeleton className="h-9 w-20 rounded-sm" delay={160 + i * 90} />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3">
          <Skeleton className="h-3 w-40 rounded-sm" delay={400} />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hairline px-4 py-3.5 last:border-b-0">
            <Skeleton className="size-8 shrink-0 rounded-full" delay={460 + i * 70} />
            <Skeleton className="h-3 w-40 rounded-sm" delay={480 + i * 70} />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" delay={500 + i * 70} />
            <Skeleton className="hidden h-3 w-24 rounded-sm sm:block" delay={520 + i * 70} />
          </div>
        ))}
      </div>
    </div>
  );
}
