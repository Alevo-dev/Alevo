"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";
import { ChannelIcons, FitMeter, Panel, StatusIcon } from "@/components/conversations/kit";
import { COLUMNS, DEFAULT_COLUMNS, nextSort, parseColumns, sortRows, type ColumnKey, type ListRow, type SortState } from "@/lib/clients/list-view";
import { cx } from "@/lib/cx";
import { CONVERSATION_STATUS } from "@/lib/ui/status";

const STORE = "alevo.conversations.columns";

/**
 * The Clients panel: the table with a Columns picker (choice kept in this
 * browser) and sortable headers. ponytail: sorting reorders only the loaded page;
 * keyset paging stays by last activity, so a sort never reaches rows on other pages.
 */
export function ClientsPanel({ rows, empty, footer }: { rows: ListRow[]; empty: ReactNode; footer: ReactNode }) {
  const [cols, setCols] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [sort, setSort] = useState<SortState>(null);

  // Read after mount so the server and first client render agree.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after mount
      setCols(parseColumns(localStorage.getItem(STORE)));
    } catch {
      /* storage blocked: keep the defaults */
    }
  }, []);

  const toggle = (key: ColumnKey) => {
    const next = cols.includes(key) ? cols.filter((k) => k !== key) : COLUMNS.map((c) => c.key).filter((k) => k === key || cols.includes(k));
    setCols(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
  };

  const shown = COLUMNS.filter((c) => cols.includes(c.key));
  const sorted = sortRows(rows, sort);

  return (
    <Panel
      title="Clients"
      hint="Most recent activity first"
      flush
      footer={footer}
      right={
        <Menu
          button={
            <>
              <Columns3 className="size-[15px] text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
              Columns
            </>
          }
          buttonClassName={buttonClass("secondary", "sm")}
          menuLabel="Columns"
          align="end"
          groups={[COLUMNS.filter((c) => c.optional).map((c) => ({ key: c.key, label: c.label, selected: cols.includes(c.key), onSelect: () => toggle(c.key) }))]}
        />
      }
    >
      <Table>
        <thead>
          <tr>
            <Th className="w-9">
              <span className="sr-only">Status</span>
            </Th>
            {shown.map((c) => {
              const on = sort?.key === c.key ? sort : null;
              return (
                <Th key={c.key} aria-sort={on ? (on.dir === "asc" ? "ascending" : "descending") : undefined} className={c.align === "right" ? "text-right" : undefined}>
                  <button type="button" onClick={() => setSort(nextSort(sort, c.key))} className={cx("inline-flex items-center gap-1 rounded-xs hover:text-ink", on && "text-ink")}>
                    {c.label}
                    {on && (on.dir === "asc" ? <ArrowUp className="size-3" strokeWidth={2} aria-hidden="true" /> : <ArrowDown className="size-3" strokeWidth={2} aria-hidden="true" />)}
                  </button>
                </Th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <EmptyRow colSpan={shown.length + 1}>{empty}</EmptyRow>
          ) : (
            sorted.map((r) => {
              const status = r.status ? CONVERSATION_STATUS[r.status] : null;
              return (
                <Tr key={r.id}>
                  <Td>
                    <StatusIcon status={r.status} />
                  </Td>
                  {shown.map((c) => (
                    <Td key={c.key} className={cell(c.key)}>
                      {c.key === "client" && (
                        <>
                          <Link href={`/conversations/client/${r.id}`} transitionTypes={["nav-forward"]} className="font-semibold text-ink no-underline hover:underline">
                            {r.name}
                          </Link>
                          <span className="block text-[12.5px] text-ink-muted">{r.sub || " "}</span>
                        </>
                      )}
                      {c.key === "channels" && <ChannelIcons channels={r.channels} />}
                      {c.key === "status" && (status ? <Pill tone={status.tone}>{status.label}</Pill> : <span className="text-ink-muted">—</span>)}
                      {c.key === "fit" && <FitMeter score={r.maxFit} />}
                      {c.key === "open" && <span className={r.openCount ? "text-ink" : "text-ink-muted"}>{r.openCount}</span>}
                      {c.key === "activity" && <span className="text-[12px]">{r.activityLabel}</span>}
                      {c.key === "timezone" && (r.timezone ?? "—")}
                      {c.key === "consent" && (r.consentSource ?? "—")}
                    </Td>
                  ))}
                </Tr>
              );
            })
          )}
        </tbody>
      </Table>
    </Panel>
  );
}

const cell = (key: ColumnKey) =>
  key === "fit" ? "text-right" : key === "open" ? "tabular text-right font-mono" : key === "activity" || key === "timezone" ? "tabular whitespace-nowrap font-mono text-ink-muted" : key === "consent" ? "text-ink-muted" : undefined;
