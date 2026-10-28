import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buttonClass } from "@alevo/ui/button";
import { CardFooter } from "@alevo/ui/card";

/** Card footer pointing at the page that holds (and pages through) the whole list. */
export function ViewAll({ href, label, children }: { href: string; label?: string; children: React.ReactNode }) {
  return (
    <CardFooter>
      <span className="text-label text-ink-muted">{label}</span>
      <Link href={href} className={buttonClass("ghost", "sm", "no-underline")}>
        {children}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </CardFooter>
  );
}
