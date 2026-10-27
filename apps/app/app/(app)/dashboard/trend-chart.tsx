"use client";

import { useId, useState } from "react";
import { labelStep, niceMax, showLabel } from "@/lib/dashboard/window";

export type TrendPoint = { label: string; short: string; n: number };

const FILL: Record<"brand" | "success", string> = {
  brand: "var(--color-brand)",
  success: "var(--color-success)",
};

// Drawing frame; the SVG scales to its card width, so a chart in a narrow card
// gets a narrower frame (`width`) to keep its text readable.
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 36 };
const PLOT_H = H - PAD.top - PAD.bottom;

/**
 * One series of counts over time, as in the dashboard mockup: `area` draws a
 * line with a soft fill and a dot per point (the leads chart); `columns` draws
 * thin bars from one baseline with 4px caps (meetings). Both: recessive
 * hairline gridlines, text in ink tokens, a hover / focus tooltip per point, a
 * direct label on the peak, and an sr-only table of the same numbers.
 */
export function TrendChart({
  points,
  unit,
  kind = "columns",
  tone = "brand",
  width = 640,
}: {
  points: TrendPoint[];
  /** Noun for the tooltip and table, e.g. "leads". */
  unit: string;
  kind?: "area" | "columns";
  tone?: "brand" | "success";
  /** Frame width in SVG units; ~the card's pixel width keeps 12px text at 12px. */
  width?: number;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);

  const W = width;
  const PLOT_W = W - PAD.left - PAD.right;
  const n = points.length;
  const max = niceMax(Math.max(0, ...points.map((p) => p.n)));
  const total = points.reduce((s, p) => s + p.n, 0);
  const peak = points.reduce((best, p, i) => (p.n > (points[best]?.n ?? 0) ? i : best), 0);
  // Roughly 70 units per label keeps "Oct 27" clear of its neighbours at any width.
  const step = labelStep(n, Math.floor(PLOT_W / 70));
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;
  const color = FILL[tone];

  // Columns sit in bands; the area chart's points sit on the band edges.
  const band = PLOT_W / Math.max(1, n);
  const barW = Math.min(24, Math.max(4, band * 0.62));
  const cx = (i: number) => (kind === "area" ? PAD.left + (n > 1 ? (i * PLOT_W) / (n - 1) : PLOT_W / 2) : PAD.left + i * band + band / 2);
  const hitX = (i: number) => (kind === "area" ? cx(i) - band / 2 : PAD.left + i * band);

  const line = points.map((p, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)} ${y(p.n).toFixed(1)}`).join(" ");
  const area = `${line} L${cx(n - 1).toFixed(1)} ${y(0)} L${cx(0).toFixed(1)} ${y(0)} Z`;

  const current = active == null ? null : points[active];
  const ticks = [0, max / 2, max];

  return (
    <div className="relative mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`${total} ${unit} across ${n} periods, peak ${points[peak]?.n ?? 0} on ${points[peak]?.label ?? ""}`}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-hairline)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--color-ink-muted)" className="tabular font-mono">
              {t}
            </text>
          </g>
        ))}

        {kind === "area" && n > 1 && (
          <>
            <path d={area} fill={`url(#${id}-fill)`} className="animate-rise" />
            <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength="1" className="animate-draw" />
            {active != null && (
              <line x1={cx(active)} x2={cx(active)} y1={PAD.top} y2={y(0)} stroke="var(--color-control)" strokeWidth="1" />
            )}
          </>
        )}

        {points.map((p, i) => {
          const h = p.n > 0 ? Math.max(3, PLOT_H * (p.n / max)) : 0;
          const top = y(0) - h;
          const r = Math.min(4, barW / 2, h);
          const left = cx(i) - barW / 2;
          const column =
            h > 0 ? `M${left} ${y(0)} V${top + r} a${r} ${r} 0 0 1 ${r} -${r} h${barW - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} V${y(0)} Z` : "";
          const dim = active != null && active !== i;
          return (
            <g key={i}>
              {kind === "columns" && column && (
                <path
                  d={column}
                  fill={color}
                  opacity={dim ? 0.55 : 1}
                  className="animate-grow-y"
                  style={{ transformBox: "fill-box", transformOrigin: "bottom", animationDelay: `${60 + i * (n > 20 ? 15 : 50)}ms` }}
                />
              )}
              {kind === "area" && (
                // 8px dot with a 2px surface ring so it reads over the line.
                <circle cx={cx(i)} cy={y(p.n)} r={active === i ? 5 : 4} fill="var(--color-surface)" stroke={color} strokeWidth="2" />
              )}
              {/* Hit target: the whole band, keyboard focusable. */}
              <rect
                x={hitX(i)}
                y={PAD.top}
                width={band}
                height={PLOT_H}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.label}: ${p.n} ${unit}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
              {i === peak && p.n > 0 && (
                <text x={cx(i)} y={y(p.n) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-ink)" className="tabular font-mono">
                  {p.n}
                </text>
              )}
              {showLabel(i, n, step) && (
                <text
                  x={cx(i)}
                  y={H - 8}
                  textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  fontSize="12"
                  fill="var(--color-ink-muted)"
                >
                  {p.short}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {current && active != null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-sm border border-hairline bg-raised px-2.5 py-1.5 text-xs shadow-sm"
          style={{ left: `${(cx(active) / W) * 100}%` }}
        >
          <span className="tabular font-mono font-semibold text-ink">{current.n}</span>{" "}
          <span className="text-ink-muted">
            {unit} · {current.label}
          </span>
        </div>
      )}

      <table className="sr-only" aria-label={`${unit} by period`}>
        <thead>
          <tr>
            <th>Period</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <td>{p.label}</td>
              <td>{p.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
