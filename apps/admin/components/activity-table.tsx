import { EmptyRow, Table, Td, Th, Tr } from "@alevo/ui/table";
import type { ActivityRow } from "@/lib/activity";
import { fmtWhen } from "@/lib/metrics-format";

/**
 * The audit log as a table. `actor` adds who did it (the dedicated page); the
 * dashboard card leaves it out for width.
 */
export function ActivityTable({
  rows,
  actor = false,
  empty,
  className,
}: {
  rows: ActivityRow[];
  actor?: boolean;
  empty: React.ReactNode;
  className?: string;
}) {
  return (
    <Table className={className}>
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Action</Th>
          <Th>Target</Th>
          <Th>Org</Th>
          {actor && <Th>By</Th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={actor ? 5 : 4}>{empty}</EmptyRow>
        ) : (
          rows.map((a) => (
            <Tr key={a.id}>
              <Td className="tabular whitespace-nowrap font-mono text-label text-ink-muted">{fmtWhen(a.createdAt)}</Td>
              <Td className="font-mono text-label text-ink">{a.action}</Td>
              <Td className="max-w-[220px] truncate text-ink-muted">{a.target ?? "—"}</Td>
              <Td className="text-ink-muted">{a.orgName ?? (a.orgId ? a.orgId.slice(0, 8) : "—")}</Td>
              {actor && <Td className="text-ink-muted">{a.actor ?? "System"}</Td>}
            </Tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
