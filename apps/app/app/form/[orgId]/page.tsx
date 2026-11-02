import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Notice } from "@/components/ui/notice";
import { loadContactDetails } from "@/lib/leads/contact-details";
import { onAccent, parseAccent } from "@/lib/leads/present";
import { ContactInfo } from "./contact-info";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";

type Search = {
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

  // The workspace brand colour recolours the panel, button and focus ring; `?accent=#hex` overrides it for one link.
  const accent = parseAccent(search.accent) ?? parseAccent(org.accent);
  // The saved font colour goes with the saved brand colour; a `?accent=` link brings its own contrast pick.
  const savedText = search.accent ? undefined : parseAccent(org.textColor);
  const onBrand = savedText ?? (accent ? onAccent(accent) : undefined);
  const style = {
    colorScheme: "light",
    ...(accent ? { "--ds-brand": accent, "--ds-brand-sky": accent } : {}),
    ...(onBrand ? { "--ds-on-brand": onBrand } : {}),
  } as CSSProperties;
  const hasDetails = search.details !== "0" && !!(org.phone || org.email || org.address || org.hours);

  // One rounded card: a coloured panel (who we are, how to reach us) beside the form.
  // Below md the two stack, panel first.
  const card = (
    <div className="grid overflow-hidden rounded-2xl bg-surface shadow-float md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative flex flex-col gap-5 overflow-hidden bg-brand p-6 text-on-brand md:gap-8 md:p-10">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 hidden size-60 rounded-full bg-on-brand/10 md:block" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-12 hidden size-44 rounded-full bg-on-brand/10 md:block" />
        <div className="relative">
          <p className="text-label font-semibold uppercase tracking-widest">Get in touch</p>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">Contact {org.name}</h1>
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

  return (
    // Always light: a public page for the owner's visitors, not Alevo's dark app theme.
    <main style={style} className="light min-h-dvh bg-canvas px-4 py-8 text-ink md:py-16">
      <div className="mx-auto max-w-5xl">{card}</div>
    </main>
  );
}
