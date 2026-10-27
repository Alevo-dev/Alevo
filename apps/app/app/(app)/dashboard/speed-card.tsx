import { Card, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { fmtDuration, speedLevel } from "@/lib/dashboard/window";

const STATE = {
  success: "Under a minute",
  warning: "Slower than target",
  danger: "Well over target",
  muted: "No replies yet",
} as const;

export type SpeedPoint = { label: string; seconds: number | null };

/**
 * Speed to lead, as in the mockup: the median and the 95th percentile of the
 * first reply over the window, then a violet sparkline of the median per day
 * (or per week). Counts only leads that got a reply. The pill names the state
 * against the 60-second target, so it never rests on colour alone.
 */
export function SpeedCard({
  p50,
  p95,
  replied,
  trend,
  per,
}: {
  p50: number | null;
  p95: number | null;
  replied: number;
  trend: SpeedPoint[];
  per: string;
}) {
  const level = speedLevel(p95);
  return (
    <Card>
      <CardHeader title="Speed to lead" aside={<Pill tone={level}>{STATE[level]}</Pill>} />
      <dl className="mt-4 flex justify-between gap-4">
        <div>
          <dt className="text-label text-ink-muted">Median</dt>
          <dd className="tabular mt-1 font-mono text-metric font-medium tracking-tight text-ink">{p50 == null ? "—" : fmtDuration(p50)}</dd>
        </div>
        <div>
          <dt className="text-label text-ink-muted">95th percentile</dt>
          <dd className="tabular mt-1 font-mono text-metric font-medium tracking-tight text-ink">{p95 == null ? "—" : fmtDuration(p95)}</dd>
        </div>
      </dl>
      <Sparkline points={trend} />
      <p className="mt-2 text-label text-ink-muted">
        Median first reply {per} · {replied} {replied === 1 ? "lead" : "leads"} answered · target 60s
      </p>
    </Card>
  );
}

const W = 240;
const H = 60;

/** The median reply time per bucket as one violet line; gaps where nothing was answered. */
function Sparkline({ points }: { points: SpeedPoint[] }) {
  const known = points.filter((p) => p.seconds != null) as { label: string; seconds: number }[];
  const n = points.length;
  if (known.length < 2 || n < 2) {
    return (
      <p className="mt-5 flex h-[60px] items-center justify-center rounded-sm bg-raised/40 text-label text-ink-muted">
        {known.length === 0 ? "No replies in this window yet" : "Trend appears after a second period with replies"}
      </p>
    );
  }
  const max = Math.max(1, ...known.map((p) => p.seconds));
  const x = (i: number) => (i * W) / (n - 1);
  const y = (s: number) => 4 + (H - 8) - (s / max) * (H - 8);
  // One path per run of consecutive known points, so a quiet day shows as a gap.
  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (p.seconds == null) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
      return;
    }
    run.push(`${run.length ? "L" : "M"}${x(i).toFixed(1)} ${y(p.seconds).toFixed(1)}`);
  });
  if (run.length > 1) runs.push(run.join(" "));
  const first = known[0]!;
  const last = known[known.length - 1]!;

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-5 block h-auto w-full"
        role="img"
        aria-label={`Median reply time from ${fmtDuration(first.seconds)} on ${first.label} to ${fmtDuration(last.seconds)} on ${last.label}`}
      >
        {runs.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--color-violet)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength="1"
            className="animate-draw"
          />
        ))}
      </svg>
      <table className="sr-only" aria-label="Median reply time by period">
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <td>{p.label}</td>
              <td>{p.seconds == null ? "no replies" : fmtDuration(p.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
