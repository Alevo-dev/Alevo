import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/**
 * The trail under the top bar. The first item is "home": its icon always links there. With more than three steps the
 * home NAME is dropped (the icon stays, so the way back is still one click) to keep the trail short; with fewer it
 * reads in full. Every other step with an `href` links back to its level; the last is the page you are on.
 * Long trails scroll sideways on a phone instead of wrapping.
 */
export function Breadcrumb({ icon, items }: { icon: ReactNode; items: Crumb[] }) {
  const [home, ...rest] = items;
  const shown = items.length > 3 ? rest : items;
  const last = shown.length - 1;
  const focus = "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  return (
    <nav aria-label="Breadcrumb" className="pb-1 text-label text-ink-muted">
      <ol className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
        <li className="flex shrink-0 items-center">
          {home?.href && items.length > 3 ? (
            <Link href={home.href} aria-label={home.label} title={home.label} className={`${focus} flex p-0.5 hover:text-ink`}>
              {icon}
            </Link>
          ) : (
            <span aria-hidden="true">{icon}</span>
          )}
        </li>
        {shown.map((c, i) => (
          <li key={`${i}-${c.label}`} className="flex shrink-0 items-center gap-1.5">
            {(i > 0 || items.length > 3) && <ChevronRight className="size-3.5 text-ink-muted/70" strokeWidth={1.75} aria-hidden="true" />}
            {i === last ? (
              <span aria-current="page" className="font-medium text-ink">
                {c.label}
              </span>
            ) : c.href ? (
              <Link href={c.href} className={`${focus} px-0.5 font-medium text-ink-muted no-underline transition-colors hover:text-ink hover:underline`}>
                {c.label}
              </Link>
            ) : (
              <span>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
