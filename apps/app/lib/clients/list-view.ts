import type { Channel, ConversationStatus } from "@alevo/db";

/**
 * The Conversations table as the browser sees it: a plain row per client, the
 * optional columns and the client-side sort. Pure so it is unit-tested.
 */

export type ListRow = {
  id: string;
  name: string;
  /** Second line under the name: company, else email. */
  sub: string;
  channels: Channel[];
  status: ConversationStatus | null;
  maxFit: number | null;
  openCount: number;
  /** Epoch ms, for sorting; `activityLabel` is the formatted text. */
  activityAt: number;
  activityLabel: string;
  timezone: string | null;
  consentSource: string | null;
};

export type ColumnKey = "client" | "channels" | "status" | "fit" | "open" | "activity" | "timezone" | "consent";

export const COLUMNS: { key: ColumnKey; label: string; align?: "right"; optional?: boolean; off?: boolean }[] = [
  { key: "client", label: "Client" },
  { key: "channels", label: "Channels", optional: true },
  { key: "status", label: "Latest status", optional: true },
  { key: "fit", label: "Fit", align: "right", optional: true },
  { key: "open", label: "Open", align: "right", optional: true },
  { key: "activity", label: "Last activity", optional: true },
  { key: "timezone", label: "Timezone", optional: true, off: true },
  { key: "consent", label: "Consent source", optional: true, off: true },
];

export const DEFAULT_COLUMNS: ColumnKey[] = COLUMNS.filter((c) => !c.off).map((c) => c.key);

/** Saved choice -> valid column keys; the name column always stays, junk falls back to the defaults. */
export function parseColumns(raw: string | null): ColumnKey[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(v)) return DEFAULT_COLUMNS;
    const keys = COLUMNS.map((c) => c.key).filter((k) => k === "client" || v.includes(k));
    return keys.length ? keys : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export type SortState = { key: ColumnKey; dir: "asc" | "desc" } | null;

/** Click cycle: first click ascending, second descending, third back to the server's order (activity). */
export function nextSort(cur: SortState, key: ColumnKey): SortState {
  if (cur?.key !== key) return { key, dir: "asc" };
  return cur.dir === "asc" ? { key, dir: "desc" } : null;
}

const text = (v: string | null | undefined) => (v ?? "").toLowerCase();
const VALUE: Record<ColumnKey, (r: ListRow) => string | number | null> = {
  client: (r) => text(r.name),
  channels: (r) => r.channels.length,
  status: (r) => r.status,
  fit: (r) => r.maxFit,
  open: (r) => r.openCount,
  activity: (r) => r.activityAt,
  timezone: (r) => text(r.timezone) || null,
  consent: (r) => text(r.consentSource) || null,
};

/** Sort the loaded page. Empty values always sort last, whichever the direction. */
export function sortRows(rows: ListRow[], sort: SortState): ListRow[] {
  if (!sort) return rows;
  const get = VALUE[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * sign;
  });
}
