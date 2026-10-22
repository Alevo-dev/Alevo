import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import type { ConnectionHealth } from "@/lib/integrations/health";

/** Shared shape for the two cards beside each other: same height, filled to the bottom. */
export const PAIR_CARD_CLASS = "flex h-full min-h-[360px] flex-col gap-6";

const W = 640;
const H = 96;
const PAD = 8;

/** Last 24 hours of webhook outcomes: hourly failure line plus the two totals. */
export function ConnectionHealthCard({ health }: { health: ConnectionHealth }) {
  const last = health.buckets.length - 1;
  // Plot the hourly failed share for hours that had any traffic; quiet hours leave a gap.
  const points = health.buckets.flatMap((b, i) => {
    const total = b.ok + b.failed;
    if (total === 0) return [];
    const x = PAD + (i / last) * (W - 2 * PAD);
    const y = PAD + (b.failed / total) * (H - 2 * PAD);
    return [`${x.toFixed(1)},${y.toFixed(1)}`];
  });
  const rateLabel = health.successRate === null ? "No data" : `${(health.successRate * 100).toFixed(1)}%`;

  return (
    <Card as="section" padding="md" aria-labelledby="connection-health" className={PAIR_CARD_CLASS}>
      <div>
        <h2 id="connection-health" className="text-heading font-semibold text-ink">
          Connection health
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Last 24 hours across all connected services</p>
        {health.total === 0 && (
          <p className="mt-2 text-sm text-ink-muted">
            No webhooks yet. This fills in as Cal.com, Calendly, Twilio and Resend send events.
          </p>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="min-h-24 w-full flex-1"
        role="img"
        aria-label={`Share of webhooks that failed, by hour, over the last 24 hours (top edge is none failed). ${health.failed} failed of ${health.total}.`}
      >
        <line x1={0} x2={W} y1={H - 1} y2={H - 1} className="stroke-hairline" vectorEffect="non-scaling-stroke" />
        {points.length > 1 && (
          <polyline
            className="animate-draw stroke-brand"
            pathLength="1"
            points={points.join(" ")}
            fill="none"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Webhooks ok" value={rateLabel} hint={`${health.ok} of ${health.total} acknowledged`} />
        <StatTile label="Failed" value={health.failed} hint="Rejected or errored" />
      </div>
    </Card>
  );
}
