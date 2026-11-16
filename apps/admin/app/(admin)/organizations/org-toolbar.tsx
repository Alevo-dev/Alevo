"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@alevo/ui/button";
import { controlClass } from "@alevo/ui/field";

/** Board toolbar: Refresh on the left, the name filter on the right (a plain GET that keeps the window). */
export function OrgToolbar({ q, days }: { q: string; days: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button onClick={() => start(() => router.refresh())} loading={pending} size="sm">
        {!pending && <RefreshCw className="size-3.5 text-ink-muted" strokeWidth={2} aria-hidden="true" />}
        Refresh
      </Button>
      <form action="/organizations" role="search" noValidate className="ml-auto">
        <input type="hidden" name="window" value={days} />
        <label className={controlClass(false, "flex min-w-60 items-center gap-1.5 text-ink-muted focus-within:border-brand", true)}>
          <Search className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <input
            key={q}
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Filter organizations"
            aria-label="Filter organizations"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none! shadow-none! placeholder:text-ink-muted"
          />
        </label>
      </form>
    </div>
  );
}
