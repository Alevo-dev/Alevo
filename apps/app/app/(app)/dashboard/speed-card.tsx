import { Card, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { fmtDuration, speedLevel, speedShare } from "@/lib/dashboard/window";

const STATE = {
  success: "Under the 60s target",
  warning: "Slower than the 60s target",
  danger: "Well over the 60s target",
  muted: "No replies yet",
} as const;

/**
 * Speed to lead, as in the board: the median and the 95th percentile of the
 * first reply over the window, a bar of the median against the 60-second target,
 * and how many leads were answered. Counts only leads that got a reply and that
 * the agent could work (leads that arrived while it was off or paused are noted,
 * not counted). The pill names the state, so it never rests on colour alone.
 */
export function SpeedCard({
  p50,
  p95,
  replied,
  excluded,
}: {
  p50: number | null;
  p95: number | null;
  replied: number;
  /** Leads in the window the agent could not work (off, paused, unsubscribed); not counted above. */
  excluded: number;
}) {
  const level = speedLevel(p95);
  return (
    <Card>
      <CardHeader title="Speed to lead" hint="Lead received to first reply" />
      <div className="flex items-end gap-6">
        <div>
          <div className="text-sm text-ink-muted">Median</div>
          <div className="tabular font-mono text-[28px] leading-[34px] text-ink">{p50 == null ? "—" : fmtDuration(p50)}</div>
        </div>
        <div>
          <div className="text-sm text-ink-muted">95th percentile</div>
          <div className="tabular font-mono text-xl leading-[34px] text-ink">{p95 == null ? "—" : fmtDuration(p95)}</div>
        </div>
        <div className="ml-auto">
          <Pill tone={level}>{STATE[level]}</Pill>
        </div>
      </div>
      <div className="my-3 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <span
          className="animate-grow-x block h-full origin-left rounded-full bg-[linear-gradient(100deg,var(--color-brand-sky),var(--color-violet-light))]"
          style={{ width: `${speedShare(p50)}%` }}
        />
      </div>
      <div className="flex justify-between gap-3 text-sm text-ink-muted">
        <span>
          {replied} {replied === 1 ? "lead" : "leads"} answered
        </span>
        {excluded > 0 && <span>{excluded} not counted (agent off or paused)</span>}
      </div>
    </Card>
  );
}
