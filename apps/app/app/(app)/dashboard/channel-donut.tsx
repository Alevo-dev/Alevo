"use client";

import { useState } from "react";
import type { Channel } from "@alevo/db";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import { cx } from "@/lib/cx";
import { fmtCount } from "@/lib/format";

/** One colour per channel, as on the board. */
const COLOR: Record<Channel, string> = {
  form: "var(--color-brand)",
  chat: "var(--color-violet)",
  voice: "var(--color-success)",
  sms: "var(--color-warning)",
  email: "var(--color-danger)",
};

/** The board's names for where a lead came in. */
const SOURCE: Record<Channel, string> = { form: "Lead form", chat: "Website chat", voice: "Phone", sms: "SMS", email: "Email" };

const SIZE = 120;
const R = 44;
const STROKE = 14;

/** "Where leads come from": a donut (one ring segment per channel, largest
 *  first, starting at the top) with the total in the middle and a legend
 *  beneath. Hovering or focusing a segment (or its legend row) lifts it and
 *  shows the count and share in a tooltip. Pure SVG, no chart library. */
export function ChannelDonut({ rows }: { rows: { channel: Channel; n: number }[] }) {
  return <Donut rows={rows.map((r) => ({ key: r.channel, label: SOURCE[r.channel], n: r.n, color: COLOR[r.channel] }))} unit="leads" />;
}

export type DonutRow = { key: string; label: string; n: number; color: string };

/** The donut itself: any labelled, coloured counts (`unit` names what is counted). */
export function Donut({ rows, unit }: { rows: DonutRow[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  // Each slice starts where the ones before it end (shares as percent of the ring).
  const slices = rows.map((r, i) => ({
    ...r,
    share: (r.n / total) * 100,
    offset: rows.slice(0, i).reduce((sum, p) => sum + (p.n / total) * 100, 0),
  }));
  const label = slices
    .map((s) => `${s.label} ${Math.round(s.share)} percent`)
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
    <div className="flex items-center gap-[18px]">
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
                key={s.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={active === i ? STROKE + 3 : STROKE}
                opacity={active != null && active !== i ? 0.45 : 1}
                pathLength="100"
                strokeDasharray={`${s.share} ${100 - s.share}`}
                strokeDashoffset={-s.offset}
                role="img"
                tabIndex={0}
                aria-label={`${s.label}: ${fmtCount(s.n)} ${unit}, ${Math.round(s.share)}%`}
                className="outline-none transition-[stroke-width,opacity] duration-150"
                {...bind(i)}
              />
            ))}
          </g>
          <text x={SIZE / 2} y="58" textAnchor="middle" className="tabular fill-ink font-mono" fontSize="20" fontWeight="500">
            {current ? fmtCount(current.n) : fmtCount(total)}
          </text>
          <text x={SIZE / 2} y="74" textAnchor="middle" className="fill-ink-muted" fontSize="11">
            {current ? current.label : unit}
          </text>
        </svg>
        {current && (
          <ChartTooltip
            x={tipX}
            y={tipY}
            value={fmtCount(current.n)}
            label={`${unit} · ${current.label}`}
            detail={`${Math.round(current.share)}% of ${fmtCount(total)}`}
            swatch={current.color}
          />
        )}
      </div>
      <ul className="flex flex-1 flex-col gap-[5px] text-sm" aria-label={`Share of ${unit}`}>
        {slices.map((s, i) => (
          <li
            key={s.key}
            className={cx(
              "flex items-center justify-between gap-3 transition-opacity",
              active != null && active !== i && "opacity-50",
            )}
            {...bind(i)}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular font-mono text-ink-muted"><span className="sr-only">{Math.round(s.share)}%, </span>{fmtCount(s.n)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
