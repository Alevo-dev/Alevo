import { ExternalLink } from "lucide-react";
import { isReady, type ReadinessItem } from "@alevo/db";
import { buttonClass } from "@alevo/ui/button";
import { Card, CardHeader } from "@alevo/ui/card";
import { StatusDot } from "@alevo/ui/pill";
import { APP_URL } from "@/lib/app-url";
import { setDecline } from "../actions";
import { ActionForm } from "./action-form";

/** Deep link into the app with this workspace made active (`/admin/open`, Task 9). */
export function openInApp(clerkOrgId: string, to: string): string {
  return `${APP_URL}/admin/open?org=${encodeURIComponent(clerkOrgId)}&to=${encodeURIComponent(to)}`;
}

/** The readiness checklist for one workspace: what is done, what is missing, where to fix it. */
export function SetupCard({ orgId, clerkOrgId, items }: { orgId: string; clerkOrgId: string; items: ReadinessItem[] }) {
  const done = items.filter((i) => i.done).length;
  return (
    <Card padding="none">
      <div className="px-6 pt-6">
        <CardHeader title="Setup" hint={isReady(items) ? "Ready — every item is in place." : `${done} of ${items.length} done`} />
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
              {item.declinable && (!item.done || item.declined) && (
                <ActionForm action={setDecline} fields={{ orgId, key: item.declinable, value: String(!item.declined) }} variant="ghost">
                  {item.declined ? "Using this after all" : "Not using this"}
                </ActionForm>
              )}
              <a href={openInApp(clerkOrgId, item.href)} className={buttonClass("secondary", "sm", "no-underline")}>
                Open
                <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
