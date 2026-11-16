"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cx } from "@/lib/cx";
import { Dialog } from "@/components/ui/dialog";
import { searchClients, type ClientHit } from "@/app/(app)/search-actions";
import { QUICK_PAGES } from "./nav-items";

/**
 * The top bar's search: pages (always) and clients (from two letters). Opens with `/`
 * from anywhere that is not a text field, or a click. Enter or click goes to the hit.
 */
export function QuickSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [active, setActive] = useState(0);
  const [, start] = useTransition();
  const stamp = useRef(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const needle = q.trim().toLowerCase();
  const pages = QUICK_PAGES.filter((p) => !needle || p.label.toLowerCase().includes(needle) || p.group.toLowerCase().includes(needle));
  const hits = [
    ...pages.map((p) => ({ key: p.href, label: p.label, hint: p.group, href: p.href })),
    ...clients.map((c) => ({ key: c.id, label: c.name, hint: c.detail ?? "Client", href: `/conversations/client/${c.id}` })),
  ];

  function change(value: string) {
    setQ(value);
    setActive(0);
    const n = ++stamp.current;
    if (value.trim().length < 2) return setClients([]);
    start(async () => {
      const rows = await searchClients(value);
      if (n === stamp.current) setClients(rows);
    });
  }

  function close() {
    setOpen(false);
    setQ("");
    setClients([]);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active].href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "flex h-[30px] w-full items-center gap-2 rounded-xs border border-hairline bg-sunken px-2.5 text-left text-label text-ink-muted transition-colors hover:border-control",
          className,
        )}
      >
        <Search className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Search clients, conversations, meetings</span>
        <kbd className="hidden rounded-[4px] border border-hairline bg-canvas px-1.5 font-mono text-[11.5px] leading-4 text-ink-muted sm:inline">/</kbd>
      </button>

      <Dialog open={open} onClose={close} title="Quick navigation" description="Jump to a page or find a client." size="md">
        <input
          autoFocus
          value={q}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a page or a client name"
          aria-label="Search"
          className="h-10 w-full rounded-xs border border-control bg-surface px-3 text-sm text-ink placeholder:text-ink-muted"
        />
        <ul role="listbox" aria-label="Results" className="mt-3 max-h-80 overflow-y-auto">
          {hits.length === 0 && <li className="px-2 py-3 text-sm text-ink-muted">Nothing matches.</li>}
          {hits.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => go(h.href)}
                onMouseEnter={() => setActive(i)}
                className={cx(
                  "flex w-full items-center justify-between gap-3 rounded-xs px-2.5 py-2 text-left text-sm text-ink",
                  i === active && "bg-brand-soft",
                )}
              >
                <span className="truncate">{h.label}</span>
                <span className="shrink-0 text-label text-ink-muted">{h.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
