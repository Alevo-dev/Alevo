"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Info } from "lucide-react";
import type { ReadinessItem } from "@alevo/db";
import { Panel } from "@/components/conversations/kit";
import { cx } from "@/lib/cx";
import { DeclineButton } from "./decline-button";

/** "/workspace/integrations#booking" → "Integrations": the page a step opens. */
function pageOf(href: string): string {
  const slug = href.split("#")[0]!.split("/").filter(Boolean).at(-1) ?? "";
  return slug ? slug[0]!.toUpperCase() + slug.slice(1) : "the app";
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The owner's setup checklist as a note that opens into a panel. The note says
 * how far along the workspace is and what is left; "Open checklist" shows every
 * step with the page that finishes it. Shown to owners and admins while anything
 * is missing; gone on its own once done. A step that can be skipped has an x
 * ("Not using this") beside its link.
 */
export function GettingStarted({ items }: { items: ReadinessItem[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const done = items.filter((i) => i.done).length;
  const left = items.filter((i) => !i.done).map((i) => lower(i.label));
  const shown = left.slice(0, 3);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start gap-2.5 rounded-sm border border-brand/60 bg-brand/[0.07] px-3 py-[9px] text-[13.5px] text-brand-ink">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <b className="font-semibold">
            Getting started: {done} of {items.length} done.
          </b>{" "}
          Left to do: {shown.join(", ")}
          {left.length > shown.length ? ` and ${left.length - shown.length} more` : ""}.{" "}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="cursor-pointer text-link underline hover:text-ink"
          >
            {open ? "Close checklist" : "Open checklist"}
          </button>
        </div>
      </div>

      {open && (
        <Panel id={panelId} title="Getting started" hint={`${done} of ${items.length} done. Each step opens the page where you finish it.`}>
          <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} className="mb-3 h-1.5 overflow-hidden rounded-full bg-raised">
            <span
              className="animate-grow-x block h-full origin-left rounded-full bg-[linear-gradient(100deg,var(--color-brand-sky),var(--color-violet-light))]"
              style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
            />
          </div>
          <ul>
            {items.map((item) => {
              const decline = item.declinable && (!item.done || item.declined);
              return (
                <li key={item.key} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 border-t border-hairline/60 py-2 first:border-t-0">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "grid size-5 place-items-center rounded-full border-[1.5px]",
                      item.done ? "border-success bg-success text-on-vivid" : "border-control",
                    )}
                  >
                    {item.done && <Check className="size-[13px]" strokeWidth={2.25} />}
                  </span>
                  <div className="min-w-0">
                    <span className={cx("text-sm", item.done ? "text-ink-muted" : "font-semibold text-ink")}>
                      {item.label}
                      <span className="sr-only">{item.done ? ", done" : ", to do"}</span>
                    </span>
                    {!item.done && <span className="block text-[13px] text-ink-muted">{item.detail}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {decline && item.declinable && <DeclineButton item={item.declinable} declined={!!item.declined} />}
                    <Link href={item.href} className="inline-flex items-center gap-1 text-sm font-[550]">
                      {item.done ? "Review in" : "Set up in"} {pageOf(item.href)}
                      <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
