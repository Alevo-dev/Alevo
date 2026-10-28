import { Pill } from "@alevo/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@alevo/ui/table";
import { fmtWhen } from "@/lib/metrics-format";
import type { OrgRow } from "@/lib/orgs";

const NUM = "tabular text-right font-mono";

/** Organizations with seats, plan, subscription status and creation date. */
export function OrgsTable({ rows, empty, className }: { rows: OrgRow[]; empty: React.ReactNode; className?: string }) {
  return (
    <Table className={className}>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th className="text-right">Members</Th>
          <Th>Plan</Th>
          <Th>Status</Th>
          <Th>Created</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={5}>{empty}</EmptyRow>
        ) : (
          rows.map((o) => (
            <Tr key={o.id}>
              <Td className="font-medium text-ink">{o.name}</Td>
              <Td className={NUM}>{o.memberCount}</Td>
              <Td className="text-ink-muted">{o.planName ?? "—"}</Td>
              <Td>
                <Pill tone={o.status === "active" ? "success" : o.status === "trialing" ? "brand" : o.status ? "warning" : "muted"}>
                  {o.status ? o.status.replace("_", " ") : "No plan"}
                </Pill>
              </Td>
              <Td className="tabular font-mono text-label text-ink-muted">{fmtWhen(o.createdAt)}</Td>
            </Tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
