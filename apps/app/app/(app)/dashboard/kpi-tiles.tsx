import { StatTile } from "@/components/ui/stat-tile";

export type DailyRow = { ago: number; n: number };

/** Turn `(days ago, count)` rows into a fixed-length series, oldest first,
 *  with zero for days that had nothing. */
export function toSeries(rows: DailyRow[], days: number): number[] {
  const out = new Array<number>(days).fill(0);
  for (const r of rows) {
    const i = days - 1 - r.ago;
    if (i >= 0 && i < days) out[i] = r.n;
  }
  return out;
}

const sum = (s: number[]) => s.reduce((a, b) => a + b, 0);
const pct = (n: number, of: number) =>
  of > 0 ? `${Math.round((n / of) * 100)}%` : null;

/** The four key figures with their day-by-day mini bars. Each total is the sum
 *  of its series, so the number and the bars always agree. */
export function KpiTiles({
  days,
  leads,
  qualified,
  meetings,
  calls,
}: {
  days: number;
  leads: number[];
  qualified: number[];
  meetings: number[];
  calls: number[];
}) {
  const leadsN = sum(leads);
  const qualifiedN = sum(qualified);
  const meetingsN = sum(meetings);
  return (
    <section
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      aria-label="Key figures"
    >
      <StatTile
        label="Leads in"
        value={leadsN}
        delta={`Last ${days} days`}
        series={leads}
        tone="brand"
        featured
      />
      <StatTile
        label="Qualified"
        value={qualifiedN}
        delta={
          pct(qualifiedN, leadsN)
            ? `${pct(qualifiedN, leadsN)} of leads`
            : "Booked or handed to a rep"
        }
        series={qualified}
        tone="violet"
      />
      <StatTile
        label="Meetings booked"
        value={meetingsN}
        delta={
          pct(meetingsN, leadsN)
            ? `${pct(meetingsN, leadsN)} conversion`
            : `Last ${days} days`
        }
        series={meetings}
        tone="success"
      />
      <StatTile
        label="Missed calls recovered"
        value={sum(calls)}
        delta="Answered by the agent"
        series={calls}
        tone="warning"
      />
    </section>
  );
}
