"use client";

import { useState } from "react";
import type { Channel } from "@alevo/db";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { cx } from "@/lib/cx";
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

const SIZE = 200;
const R = 70;

/** "Where leads come from": a donut (one ring segment per channel, largest
 *  first, starting at the top) with the total in the middle and a legend
 *  beneath. Hovering or focusing a segment (or its legend row) lifts it and
 *  shows the count and share in a tooltip. Pure SVG, no chart library. */
export function ChannelDonut({
  rows,
}: {
  rows: { channel: Channel; n: number }[];
}) {
  const [active, setActive] = useState<number | null>(null);
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
  const current = active == null ? null : slices[active];
  // The tooltip sits on the ring at the slice's middle angle (the ring starts at 12 o'clock).
  const angle = current ? ((current.offset + current.share / 2) / 100) * 2 * Math.PI - Math.PI / 2 : 0;
  const tipX = (SIZE / 2 + R * Math.cos(angle)) / SIZE;
  const tipY = (SIZE / 2 + R * Math.sin(angle)) / SIZE;

  const bind = (i: number) => ({
    onPointerEnter: () => setActive(i),
    onPointerLeave: () => setActive(null),
    onFocus: () => setActive(i),
    onBlur: () => setActive(null),
  });

  return (
    <div className="mt-5 flex flex-col items-start gap-5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={label}
          className="block shrink-0 overflow-visible"
        >
          <g className="animate-spin-in origin-center">
            {slices.map((s, i) => (
              <circle
                key={s.channel}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={active === i ? 34 : 28}
                opacity={active != null && active !== i ? 0.45 : 1}
                pathLength="100"
                strokeDasharray={`${s.share} ${100 - s.share}`}
                strokeDashoffset={-s.offset}
                role="img"
                tabIndex={0}
                aria-label={`${CHANNEL_LABEL[s.channel]}: ${fmtCount(s.n)} leads, ${Math.round(s.share)}%`}
                className="outline-none transition-[stroke-width,opacity] duration-150"
                {...bind(i)}
              />
            ))}
          </g>
          <text x={SIZE / 2} y="98" textAnchor="middle" className="tabular fill-ink font-mono" fontSize="22">
            {current ? fmtCount(current.n) : fmtCount(total)}
          </text>
          <text x={SIZE / 2} y="118" textAnchor="middle" className="fill-ink-muted" fontSize="12">
            {current ? CHANNEL_LABEL[current.channel] : "leads"}
          </text>
        </svg>
        {current && (
          <ChartTooltip
            x={tipX}
            y={tipY}
            value={fmtCount(current.n)}
            label={`${current.n === 1 ? "lead" : "leads"} · ${CHANNEL_LABEL[current.channel]}`}
            detail={`${Math.round(current.share)}% of ${fmtCount(total)}`}
            swatch={current.color}
          />
        )}
      </div>
      <ul className="w-full space-y-3 text-sm" aria-label="Leads by channel">
        {slices.map((s, i) => (
          <li
            key={s.channel}
            className={cx(
              "flex items-center justify-between gap-3 transition-opacity",
              active != null && active !== i && "opacity-50",
            )}
            {...bind(i)}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {CHANNEL_LABEL[s.channel]}, {Math.round(s.share)}%
            </span>
            <span className="tabular font-mono text-label text-ink-muted">{fmtCount(s.n)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
