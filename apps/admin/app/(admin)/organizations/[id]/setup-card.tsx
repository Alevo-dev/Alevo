import { Check, ChevronRight } from "lucide-react";
import { isReady, type ReadinessItem } from "@alevo/db";
import { cx } from "@alevo/ui/cx";
import { APP_URL } from "@/lib/app-url";
import { setDecline } from "../actions";
import { ActionForm } from "./action-form";
import { CollapsibleSection } from "./collapsible-section";

/** Deep link into the app with this workspace made active (`/admin/open`, Task 9). */
export function openInApp(clerkOrgId: string, to: string): string {
  return `${APP_URL}/admin/open?org=${encodeURIComponent(clerkOrgId)}&to=${encodeURIComponent(to)}`;
}

/** "/workspace/integrations#booking" → "Integrations": the page a step opens. */
function pageOf(href: string): string {
  const slug = href.split("#")[0]!.split("/").filter(Boolean).at(-1) ?? "";
  return slug ? slug[0]!.toUpperCase() + slug.slice(1) : "the app";
}

/** The readiness checklist for one workspace, laid out like the app's Getting started panel: progress bar, a check per step, what is missing, and the page that finishes it. */
export function SetupCard({ orgId, clerkOrgId, items }: { orgId: string; clerkOrgId: string; items: ReadinessItem[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <CollapsibleSection
      title="Getting started"
      hint={isReady(items) ? "Ready: every item is in place." : `${done} of ${items.length} done. Each step opens the page in the app where it is finished.`}
    >
      <div className="py-3.5">
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} className="mb-3 h-1.5 overflow-hidden rounded-full bg-raised">
          <span
            className="animate-grow-x block h-full origin-left rounded-full bg-[linear-gradient(100deg,var(--color-brand-sky),var(--color-violet-light))]"
            style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
          />
        </div>
        <ul>
          {items.map((item) => (
            <li key={item.key} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 border-t border-hairline/60 py-2 first:border-t-0">
              <span aria-hidden="true" className={cx("grid size-5 place-items-center rounded-full border-[1.5px]", item.done ? "border-success bg-success text-on-vivid" : "border-control")}>
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
                {item.declinable && (!item.done || item.declined) && (
                  <ActionForm action={setDecline} fields={{ orgId, key: item.declinable, value: String(!item.declined) }} variant="ghost">
                    {item.declined ? "Using this after all" : "Not using this"}
                  </ActionForm>
                )}
                <a href={openInApp(clerkOrgId, item.href)} className="inline-flex items-center gap-1 text-sm font-[550]">
                  {item.done ? "Review in" : "Set up in"} {pageOf(item.href)}
                  <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </CollapsibleSection>
  );
}
