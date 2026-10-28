import { Card, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { fmtDuration, speedLevel } from "@/lib/dashboard/window";
import { SpeedSparkline, type SpeedPoint } from "./speed-sparkline";

const STATE = {
  success: "Under a minute",
  warning: "Slower than target",
  danger: "Well over target",
  muted: "No replies yet",
} as const;

export type { SpeedPoint };

/**
 * Speed to lead, as in the mockup: the median and the 95th percentile of the
 * first reply over the window, then a violet sparkline of the median per day
 * (or per week; hover a period for its value). Counts only leads that got a
 * reply. The pill names the state against the 60-second target, so it never
 * rests on colour alone.
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
      <SpeedSparkline points={trend} />
      <p className="mt-2 text-label text-ink-muted">
        Median first reply {per} · {replied} {replied === 1 ? "lead" : "leads"} answered · target 60s
      </p>
    </Card>
  );
}
