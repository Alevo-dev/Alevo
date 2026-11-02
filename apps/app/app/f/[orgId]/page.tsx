import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Notice } from "@/components/ui/notice";
import { cx } from "@/lib/cx";
import { loadContactDetails } from "@/lib/leads/contact-details";
import { onAccent, parseAccent } from "@/lib/leads/present";
import { ContactInfo } from "./contact-info";
import { FrameResize } from "./frame-resize";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";

type Search = {
  embed?: string;
  theme?: string;
  accent?: string;
  details?: string;
  submitted?: string;
  error?: string;
};

export async function generateMetadata({ params }: { params: Promise<{ orgId: string }> }): Promise<Metadata> {
  const org = await loadContactDetails((await params).orgId);
  return { title: org ? `Contact ${org.name}` : "Contact form" };
}

export default async function LeadFormPage({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<Search> }) {
  const [{ orgId }, search] = await Promise.all([params, searchParams]);
  const org = await loadContactDetails(orgId);

  if (!org) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
        <p className="text-ink-muted">This form is not available.</p>
      </main>
    );
  }

  // A plain HTML form on a customer's site posts to /api/forms and is sent back here.
  const submitted = search.submitted === "1";
  const failed = search.error === "1";
  const embed = search.embed === "1";

  // `?accent=#hex` recolours the panel, button and focus ring to match the site the frame sits in.
  const accent = parseAccent(search.accent);
  const style = accent ? ({ "--ds-brand": accent, "--ds-brand-sky": accent, "--ds-on-brand": onAccent(accent) } as CSSProperties) : undefined;
  const hasDetails = search.details !== "0" && !!(org.phone || org.email || org.address || org.hours);
  const Heading = embed ? "h2" : "h1"; // the host page owns the h1

  // One rounded card: a coloured panel (who we are, how to reach us) beside the form.
  // Below md the two stack, panel first.
  const card = (
    <div className={cx("grid overflow-hidden bg-surface md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]", embed ? "rounded-xl border border-hairline" : "rounded-2xl shadow-float")}>
      <aside className="relative flex flex-col gap-5 overflow-hidden bg-brand p-6 text-on-brand md:gap-8 md:p-10">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 hidden size-60 rounded-full bg-on-brand/10 md:block" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-12 hidden size-44 rounded-full bg-on-brand/10 md:block" />
        <div className="relative">
          <p className="text-label font-semibold uppercase tracking-widest">Get in touch</p>
          <Heading className="mt-3 text-3xl font-bold md:text-4xl">Contact {org.name}</Heading>
          <p className="mt-3 max-w-md">Tell us what you need and we&apos;ll get back to you fast.</p>
        </div>
        {hasDetails && (
          <div className="relative md:mt-auto">
            <ContactInfo details={org} />
          </div>
        )}
      </aside>
      <section className="p-6 md:p-10">
        <div className="space-y-4">
          {failed && <Notice tone="danger">Something was missing. Please check the form and send it again.</Notice>}
          <LeadForm orgId={org.id} company={org.name} submitted={submitted} />
        </div>
      </section>
    </div>
  );

  // Iframe mode: no page chrome, and the height is reported to the parent.
  if (embed) {
    const theme = search.theme === "light" || search.theme === "dark" ? search.theme : undefined;
    return (
      <main style={style} className="p-1">
        <FrameResize theme={theme} />
        {card}
      </main>
    );
  }

  return (
    <main style={style} className="mx-auto max-w-5xl px-4 py-8 md:py-16">
      {card}
    </main>
  );
}
