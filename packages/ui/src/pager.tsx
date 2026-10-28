import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "./button";
import { CardFooter } from "./card";
import { cx } from "./cx";

/**
 * "Page 3 of 12" with Previous / Next for a table that pages by cursor
 * (`@alevo/db` `finishPage`; `pages` from `pageCount(total)`). Each side is a
 * link that puts the cursor in the URL (`href(cursor)`), so the server page
 * re-queries and the spot survives a refresh or a shared link. Previous / Next
 * rather than Newer / Older: once lists can be sorted and filtered the
 * direction is whatever the sort says. Renders nothing when everything fits
 * on one page.
 */
export function Pager({
  prev,
  next,
  page,
  pages,
  href,
}: {
  prev: string | null;
  next: string | null;
  /** The page being shown, 1-based (`Page.page`). */
  page: number;
  /** Total pages when the list has a count; omitted → "Page 3". */
  pages?: number;
  href: (cursor: string | null) => string;
}) {
  if (!prev && !next) return null;
  return (
    <CardFooter as="nav" aria-label="Pages">
      <span className="text-label text-ink-muted">
        Page {page}
        {pages != null && ` of ${pages}`}
      </span>
      <span className="flex items-center gap-2">
        <PageLink href={prev ? href(prev) : null} rel="prev">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </PageLink>
        <PageLink href={next ? href(next) : null} rel="next">
          Next
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
