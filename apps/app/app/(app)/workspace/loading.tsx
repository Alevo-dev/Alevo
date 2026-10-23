import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a Workspace tab body. The "Workspace" title and the tabs above
 * come from the layout and stay put; switching tabs swaps only this area, so
 * the next tab appears instantly as settings-shaped placeholders (a card
 * header, then label-left / control-right rows) while its data streams in.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      {[0, 1].map((card) => (
        <div key={card} className="rounded-lg border border-hairline bg-surface p-6">
          <Skeleton className="h-5 w-44 rounded-sm" delay={card * 220} />
          <Skeleton className="mt-2 h-3 w-96 max-w-full rounded-sm" delay={card * 220 + 60} />
          <div className="mt-6 divide-y divide-hairline">
            {[0, 1, 2].map((row) => {
              const d = card * 220 + 120 + row * 80;
              return (
                <div key={row} className="grid gap-3 py-4 md:grid-cols-[1fr_minmax(0,28rem)] md:items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-36 rounded-sm" delay={d} />
                    <Skeleton className="h-3 w-72 max-w-full rounded-sm" delay={d + 30} />
                  </div>
                  <Skeleton className="h-10 w-full rounded-sm" delay={d + 60} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
