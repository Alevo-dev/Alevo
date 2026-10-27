import type { Channel } from "@alevo/db";
import { CHANNEL_LABEL } from "@/lib/ui/status";
import { fmtCount } from "@/lib/format";

/** Slice colours by rank (largest first): brand, violet, then the muted control
 *  grey as in the mockup, with success and warning for a fourth and fifth. */
const SLICE = [
  "var(--color-brand)",
  "var(--color-violet)",
  "var(--color-control)",
  "var(--color-success)",
  "var(--color-warning)",
];

/** "Where leads come from": a donut (one ring segment per channel, largest
 *  first, starting at the top) with the total in the middle and a legend
 *  beneath. Pure SVG, no chart library. */
export function ChannelDonut({
  rows,
}: {
  rows: { channel: Channel; n: number }[];
}) {
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  // Each slice starts where the ones before it end (shares as percent of the ring).
  const slices = rows.map((r, i) => ({
    ...r,
    share: (r.n / total) * 100,
    offset: rows.slice(0, i).reduce((sum, p) => sum + (p.n / total) * 100, 0),
    color: SLICE[i % SLICE.length]!,
  }));
  const label = slices
    .map((s) => `${CHANNEL_LABEL[s.channel]} ${Math.round(s.share)} percent`)
    .join(", ");

  return (
    <div className="mt-5 flex flex-col items-start gap-5">
      <svg
        viewBox="0 0 200 200"
        width="200"
        height="200"
        role="img"
        aria-label={label}
        className="shrink-0"
      >
        <g className="animate-spin-in origin-center">
          {slices.map((s) => (
            <circle
              key={s.channel}
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke={s.color}
              strokeWidth="28"
              pathLength="100"
              strokeDasharray={`${s.share} ${100 - s.share}`}
              strokeDashoffset={-s.offset}
            >
              <title>{`${CHANNEL_LABEL[s.channel]}: ${Math.round(s.share)}%`}</title>
            </circle>
          ))}
        </g>
        <text
          x="100"
          y="98"
          textAnchor="middle"
          className="tabular fill-ink font-mono"
          fontSize="22"
        >
          {fmtCount(total)}
        </text>
        <text
          x="100"
          y="118"
          textAnchor="middle"
          className="fill-ink-muted"
          fontSize="12"
        >
          leads
        </text>
      </svg>
      <ul className="w-full space-y-3 text-sm" aria-label="Leads by channel">
        {slices.map((s) => (
          <li
            key={s.channel}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-[3px]"
                style={{ background: s.color }}
              />
              {CHANNEL_LABEL[s.channel]}, {Math.round(s.share)}%
            </span>
            <span className="tabular font-mono text-label text-ink-muted">
              {fmtCount(s.n)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
