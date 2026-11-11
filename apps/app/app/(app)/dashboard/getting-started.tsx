import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReadinessItem } from "@alevo/db";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/pill";
import { DeclineButton } from "./decline-button";

/**
 * The owner's setup checklist (same facts as the console's Setup card). Shown
 * to owners and admins while anything is missing; gone on its own once done.
 * Built for a narrow right-hand rail: each item ends in icon actions (an arrow to
 * set it up, an x to mark it not used) so the text keeps the width.
 */
export function GettingStarted({ items, className }: { items: ReadinessItem[]; className?: string }) {
  const done = items.filter((i) => i.done).length;
  return (
    <Card padding="none" className={className}>
      <div className="px-5 pt-5">
        <CardHeader title="Getting started" hint={`${done} of ${items.length} done. Finish these and the agent is ready to work your leads.`} />
      </div>
      <ul className="mt-4 divide-y divide-hairline">
        {items.map((item) => {
          const decline = item.declinable && (!item.done || item.declined);
          return (
            <li key={item.key} className="flex items-center gap-3 px-5 py-3">
              <StatusDot tone={item.done ? "success" : "warning"} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{item.label}</div>
                <div className="text-label text-ink-muted">{item.detail}</div>
              </div>
              {(decline || !item.done) && (
                <div className="flex shrink-0 items-center gap-1">
                  {decline && item.declinable && <DeclineButton item={item.declinable} declined={!!item.declined} />}
                  {!item.done && (
                    <Link
                      href={item.href}
                      aria-label={`Set up: ${item.label}`}
                      title="Set up"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-hairline text-ink no-underline transition-colors hover:bg-raised"
                    >
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
