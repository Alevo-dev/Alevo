import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "./button";
import { CardFooter } from "./card";
import { cx } from "./cx";

/**
 * Newer / Older for a table that pages by cursor (`@alevo/db` `finishPage`).
 * Each side is a link that puts the cursor in the URL (`href(cursor)`), so the
 * server page re-queries and the spot survives a refresh or a shared link.
 * Renders nothing when everything fits on one page.
 */
export function Pager({
  newer,
  older,
  href,
  label,
}: {
  newer: string | null;
  older: string | null;
  href: (cursor: string | null) => string;
  label?: ReactNode;
}) {
  if (!newer && !older) return null;
  return (
    <CardFooter as="nav" aria-label="Pages">
      <span className="text-label text-ink-muted">{label}</span>
      <span className="flex items-center gap-2">
        <PageLink href={newer ? href(newer) : null} rel="prev">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Newer
        </PageLink>
        <PageLink href={older ? href(older) : null} rel="next">
          Older
          <ChevronRight className="size-4" aria-hidden="true" />
        </PageLink>
      </span>
    </CardFooter>
  );
}

function PageLink({ href, rel, children }: { href: string | null; rel: "prev" | "next"; children: ReactNode }) {
  const className = buttonClass("secondary", "sm");
  if (!href) {
    return (
      <span aria-disabled="true" className={cx(className, "cursor-not-allowed opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={cx(className, "no-underline")}>
      {children}
    </Link>
  );
}

/** `href` for `Pager`: `path`, any params the page already carries, plus the cursor. */
export function cursorHref(path: string, params: Record<string, string | undefined> = {}) {
  return (cursor: string | null) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (cursor) q.set("cursor", cursor);
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
}
