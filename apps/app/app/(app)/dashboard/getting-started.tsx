import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReadinessItem } from "@alevo/db";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/pill";
import { DeclineButton } from "./decline-button";

/**
 * The owner's setup checklist (same facts as the console's Setup card). Shown
 * to owners and admins while anything is missing; gone on its own once done.
 */
export function GettingStarted({ items }: { items: ReadinessItem[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <Card padding="none">
      <div className="px-6 pt-6">
        <CardHeader title="Getting started" hint={`${done} of ${items.length} done. Finish these and the agent is ready to work your leads.`} />
      </div>
      <ul className="mt-4 divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center gap-3 px-6 py-3">
            <StatusDot tone={item.done ? "success" : "warning"} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{item.label}</div>
              <div className="text-label text-ink-muted">{item.detail}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.declinable && (!item.done || item.declined) && <DeclineButton item={item.declinable} declined={!!item.declined} />}
              {!item.done && (
                <Link href={item.href} className={buttonClass("secondary", "sm", "no-underline")}>
                  Set up
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
