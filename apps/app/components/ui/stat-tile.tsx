import { Card } from "./card";
import { CountUp } from "./count-up";

/** The big-number tile: label in muted ink, value in mono with tabular figures.
 *  A numeric `value` counts up on load; pass a string to show it as-is. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card as="div" padding="sm" className="rounded-md">
      <div className="text-label text-ink-muted">{label}</div>
      <div className="tabular mt-2 font-mono text-metric font-medium tracking-tight text-ink">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
      {hint && <div className="mt-1 text-label text-ink-muted">{hint}</div>}
    </Card>
  );
}
