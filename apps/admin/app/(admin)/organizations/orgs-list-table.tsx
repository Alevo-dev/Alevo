import Link from "next/link";
import { Check, Minus, TriangleAlert } from "lucide-react";
import type { OrgFunnel } from "@alevo/db";
import { cx } from "@alevo/ui/cx";
import { Pill } from "@alevo/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@alevo/ui/table";
import type { Tone } from "@alevo/ui/tone";
import { fmtDuration, speedView } from "@/lib/metrics-format";
import type { OrgRow } from "@/lib/orgs";

const NUM = "tabular text-right font-mono";
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The board's 18px state circle: how the org's first replies are holding against the 60-second promise. */
const STATE: Record<Tone, { icon: typeof Check; ring: string; label: string }> = {
  success: { icon: Check, ring: "bg-success/15 text-success", label: "Replying under a minute" },
  warning: { icon: TriangleAlert, ring: "bg-warning/15 text-warning", label: "Replies over target" },
  danger: { icon: TriangleAlert, ring: "bg-danger/15 text-danger", label: "Replies well over target" },
  brand: { icon: Minus, ring: "bg-raised text-ink-muted", label: "No replies yet" },
  violet: { icon: Minus, ring: "bg-raised text-ink-muted", label: "No replies yet" },
  muted: { icon: Minus, ring: "bg-raised text-ink-muted", label: "No replies yet" },
};

/** Organizations with the window's funnel numbers (leads, median and p95 first reply) beside plan, seats and creation date. */
export function OrgsListTable({ rows, funnel, empty }: { rows: OrgRow[]; funnel: Map<string, OrgFunnel>; empty: React.ReactNode }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-9" aria-label="Reply speed" />
          <Th className="text-ink">Organization</Th>
          <Th>Plan</Th>
          <Th>Status</Th>
          <Th className="text-right">Seats</Th>
          <Th className="text-right">Leads</Th>
          <Th className="text-right">Median reply</Th>
          <Th className="text-right">p95 reply</Th>
          <Th>Created</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={9}>{empty}</EmptyRow>
        ) : (
          rows.map((o) => {
            const f = funnel.get(o.id);
            const speed = speedView(f?.p95 ?? null, f?.replied ?? 0);
            const { icon: Icon, ring, label } = STATE[speed.tone];
            return (
              <Tr key={o.id}>
                <Td>
                  <span title={label} className={cx("inline-flex size-[18px] items-center justify-center rounded-full", ring)}>
                    <Icon className="size-3" strokeWidth={2.25} aria-label={label} />
                  </span>
                </Td>
                <Td className="whitespace-nowrap font-semibold text-ink">
                  <Link href={`/organizations/${o.id}`} className="text-ink no-underline hover:underline">
                    {o.name}
                  </Link>
                </Td>
                <Td>{o.planName ?? "—"}</Td>
                <Td>
                  <Pill tone={o.status === "active" ? "success" : o.status === "trialing" ? "brand" : o.status ? "warning" : "muted"}>
                    {o.status ? o.status.replace("_", " ") : "No plan"}
                  </Pill>
                </Td>
                <Td className={NUM}>{o.memberCount}</Td>
                <Td className={NUM}>{f?.leads ?? 0}</Td>
                <Td className={NUM}>{fmtDuration(f?.p50 ?? null)}</Td>
                <Td className={cx(NUM, speed.tone === "danger" && "text-danger")}>{fmtDuration(f?.p95 ?? null)}</Td>
                <Td className="tabular font-mono text-ink-muted">{DAY.format(o.createdAt)}</Td>
              </Tr>
            );
          })
        )}
      </tbody>
    </Table>
  );
}
