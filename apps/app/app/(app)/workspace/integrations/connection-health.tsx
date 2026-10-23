import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import type { ConnectionHealth } from "@/lib/integrations/health";
import { HealthChart } from "./health-chart";

/** Shared shape for the two cards beside each other: same height, filled to the bottom. */
export const PAIR_CARD_CLASS = "flex h-full min-h-[360px] flex-col gap-6";

/** Last 24 hours of webhook outcomes: hourly columns plus the two totals. */
export function ConnectionHealthCard({ health }: { health: ConnectionHealth }) {
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

      <HealthChart buckets={health.buckets} />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Webhooks ok" value={rateLabel} hint={`${health.ok} of ${health.total} acknowledged`} />
        <StatTile label="Failed" value={health.failed} hint="Rejected or errored" />
      </div>
    </Card>
  );
}
