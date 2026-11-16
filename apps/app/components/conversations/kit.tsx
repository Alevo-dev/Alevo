import { Check, FileText, Mail, MessageCircle, MessageSquare, Phone, Users, X } from "lucide-react";
import type { Channel, ConversationStatus } from "@alevo/db";
import { MiniBars, type MiniBarsTone } from "@alevo/ui/mini-bars";
import { Card, CardHeader } from "@/components/ui/card";
import { InfoStrip, Tabs } from "@/components/ui/nav-kit";
import { PageHeader } from "@/components/ui/page-header";
import { CountUp } from "@/components/ui/count-up";
import { cx } from "@/lib/cx";
import { CHANNEL_LABEL } from "@/lib/ui/status";

/**
 * Page-local pieces of the dense "board" screens (Dashboard, Conversations,
 * Client, Conversation): the panel with its header band, the info strip, the
 * KPI tile, tab links, the fit meter and the channel / status icons. Tokens only.
 */

/** Title row: title, optional badge and one-line context, actions pushed right. */
export function ScreenHeader({
  title,
  badge,
  sub,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      description={
        badge || sub ? (
          <>
            {badge}
            {sub}
          </>
        ) : undefined
      }
    >
      {children}
    </PageHeader>
  );
}

/** A flat panel, as in the boards: heading row with a hairline under it, body, optional footer under a hairline. No box. */
export function Panel({
  title,
  hint,
  right,
  footer,
  flush = false,
  className,
  children,
  ...rest
}: {
  title: string;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  /** No body padding: tables and lists run edge to edge. */
  flush?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <Card padding="none" className={className} {...rest}>
      <CardHeader title={title} hint={hint} aside={right} />
      {children != null && <div className={flush ? undefined : "py-3.5"}>{children}</div>}
      {footer && <div className="flex items-center justify-between gap-3 border-t border-hairline pt-[9px] text-label text-ink-muted">{footer}</div>}
    </Card>
  );
}

/** The strip of key facts under the title. */
export function Strip({ items }: { items: { k: string; v: React.ReactNode }[] }) {
  return <InfoStrip items={items.map((i) => ({ label: i.k, value: i.v }))} className="max-md:!grid-cols-2" />;
}

export type TabItem = { label: string; href: string; count?: number; active: boolean };

/** Tab links under the strip (the shared `Tabs`, as links). */
export function TabLinks({ tabs, label }: { tabs: TabItem[]; label: string }) {
  return <Tabs label={label} value={tabs.find((t) => t.active)?.label ?? ""} options={tabs.map((t) => ({ key: t.label, label: t.label, href: t.href, count: t.count }))} />;
}

/** Up/down against the prior period: the board's "▲ 5 vs prior 7 days", coloured by direction. */
export function deltaOf(cur: number, prior: number, vs: string): { text: string; tone: "success" | "danger" | "muted" } {
  const d = cur - prior;
  if (d === 0) return { text: "— No change", tone: "muted" };
  return { text: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} ${vs}`, tone: d > 0 ? "success" : "danger" };
}

const DELTA_INK = { success: "text-success", danger: "text-danger", muted: "text-ink-muted" } as const;

/** Key-figure tile: label, mono value, delta line, mini bars bottom-right. */
export function Kpi({
  label,
  value,
  delta,
  series,
  seriesLabels,
  unit,
  period,
  tone,
}: {
  label: string;
  value: number;
  delta?: { text: string; tone: "success" | "danger" | "muted" };
  series: number[];
  seriesLabels: string[];
  unit: string;
  period: "hour" | "day" | "week";
  tone: MiniBarsTone;
}) {
  return (
    <div className="relative min-h-[100px] overflow-hidden border-l border-hairline px-4 py-3 first:border-l-0 first:pl-0 max-lg:nth-[odd]:border-l-0 max-lg:nth-[odd]:pl-0">
      <div className="text-[13px] font-[550] text-ink-muted">{label}</div>
      <div className="tabular mt-0.5 font-mono text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-ink">
        <CountUp value={value} />
      </div>
      {delta && <div className={cx("mt-0.5 text-[12.5px]", DELTA_INK[delta.tone])}>{delta.text}</div>}
      <MiniBars series={series} labels={seriesLabels} unit={unit} period={period} tone={tone} />
    </div>
  );
}

/** Score 0-100 as a number and a short bar: green from 70, amber from 40, red below. */
export function fitTone(score: number): "success" | "warning" | "danger" {
  return score >= 70 ? "success" : score >= 40 ? "warning" : "danger";
}
const FIT_FILL = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" } as const;

export function FitMeter({ score }: { score: number | null }) {
  if (score == null) return <span className="text-ink-muted">—</span>;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="tabular font-mono text-ink">{score}</span>
      <i aria-hidden="true" className="block h-1 w-11 overflow-hidden rounded-full bg-raised">
        <b className={cx("block h-full", FIT_FILL[fitTone(score)])} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </i>
      <span className="sr-only">out of 100</span>
    </span>
  );
}

/** Channel marks as on the board: SMS a round bubble, chat a square one. */
export const CHANNEL_ICON: Record<Channel, typeof Phone> = { form: FileText, email: Mail, sms: MessageCircle, chat: MessageSquare, voice: Phone };

export function ChannelIcons({ channels }: { channels: Channel[] }) {
  if (channels.length === 0) return <span className="text-[13px] text-ink-muted">None yet</span>;
  return (
    <span className="inline-flex gap-1.5 text-ink-muted">
      {channels.map((ch) => {
        const Icon = CHANNEL_ICON[ch];
        return <Icon key={ch} className="size-3.5" strokeWidth={1.75} role="img" aria-label={CHANNEL_LABEL[ch]} />;
      })}
    </span>
  );
}

const STATUS_ICON: Record<ConversationStatus, { Icon: typeof Check; cls: string }> = {
  new: { Icon: MessageSquare, cls: "bg-brand/15 text-brand-ink" },
  active: { Icon: MessageSquare, cls: "bg-brand/15 text-brand-ink" },
  booked: { Icon: Check, cls: "bg-success/15 text-success" },
  handed_off: { Icon: Users, cls: "bg-warning/15 text-warning" },
  disqualified: { Icon: X, cls: "bg-danger/15 text-danger" },
  closed: { Icon: X, cls: "bg-raised text-ink-muted" },
};

/** The round status mark at the start of a client row (the label sits in the pill beside it). */
export function StatusIcon({ status }: { status: ConversationStatus | null }) {
  if (!status) return null;
  const { Icon, cls } = STATUS_ICON[status];
  return (
    <span aria-hidden="true" className={cx("inline-flex size-[18px] items-center justify-center rounded-full", cls)}>
      <Icon className="size-3" strokeWidth={2} />
    </span>
  );
}

const FIT_INK = { success: "text-success", warning: "text-warning", danger: "text-danger" } as const;
const FIT_STROKE = { success: "var(--color-success)", warning: "var(--color-warning)", danger: "var(--color-danger)" } as const;
const FIT_WORD = { success: "Strong fit", warning: "Possible fit", danger: "Weak fit" } as const;

/** The client's best score: a ring, the verdict and a 0 / 40 / 70 / 100 scale with a marker. */
export function FitCard({ score }: { score: number }) {
  const tone = fitTone(score);
  const C = 2 * Math.PI * 25;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <span className="mr-2.5 inline-flex items-center gap-3" role="img" aria-label={`Best fit ${score} of 100, ${FIT_WORD[tone].replace(" fit", "")}`}>
      <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
        <circle cx="34" cy="34" r="25" fill="none" stroke="var(--color-raised)" strokeWidth="7" />
        <circle cx="34" cy="34" r="25" fill="none" stroke={FIT_STROKE[tone]} strokeWidth="7" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 34 34)" />
        <text x="34" y="40" textAnchor="middle" fontSize="20" fontWeight="700" fill={FIT_STROKE[tone]} className="font-mono">
          {score}
        </text>
      </svg>
      <span className="flex w-32 flex-col gap-[3px]" aria-hidden="true">
        <span className="text-xs font-[550] uppercase tracking-[0.05em] text-ink-muted">Best fit score</span>
        <b className={cx("font-display text-[17px] leading-5", FIT_INK[tone])}>{FIT_WORD[tone]}</b>
        <span className="relative mt-0.5 flex h-1.5 gap-0.5 rounded-[3px]">
          <i className="block h-1.5 rounded-[2px] bg-danger" style={{ width: "40%" }} />
          <i className="block h-1.5 rounded-[2px] bg-warning" style={{ width: "30%" }} />
          <i className="block h-1.5 rounded-[2px] bg-success" style={{ width: "30%" }} />
          <u className="absolute -top-[3px] -ml-px h-3 w-[3px] rounded-[2px] bg-ink no-underline shadow-[0_0_0_1.5px_var(--color-canvas)]" style={{ left: `${pct}%` }} />
        </span>
        <span className="flex justify-between font-mono text-xs text-ink-muted">
          <span>0</span>
          <span>40</span>
          <span>70</span>
          <span>100</span>
        </span>
      </span>
    </span>
  );
}
