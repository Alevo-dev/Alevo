import { CardTitle } from "@/components/ui/card";
import { fmtShort } from "@/lib/format";
import type { LinkedRecord } from "@/lib/psa/writeback";

const LABEL: Record<string, string> = {
  company: "Company",
  contact: "Contact",
  "activity:handed_off": "Activity: handed off",
  "activity:booked": "Activity: meeting booked",
  opportunity: "Opportunity",
};

/**
 * What the PSA holds for this lead, from the write-back ledger. Only renders
 * once something was written, so orgs without a PSA never see it.
 */
export function PsaPanel({ records, tz }: { records: LinkedRecord[]; tz: string }) {
  if (records.length === 0) return null;
  return (
    <div>
      <CardTitle>In ConnectWise</CardTitle>
      <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
        {records.map((r) => (
          <div key={`${r.kind}-${r.remoteId}`} className="contents">
            <dt className="text-ink">
              {LABEL[r.kind] ?? r.kind} <span className="font-mono text-label text-ink-muted">#{r.remoteId}</span>
            </dt>
            <dd className="tabular text-right font-mono text-label text-ink-muted">{fmtShort(r.createdAt, tz)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
