import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Notice } from "@/components/ui/notice";
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

  // `?accent=#hex` recolours the button and focus ring to match the site the frame sits in.
  const accent = parseAccent(search.accent);
  const style = accent ? ({ "--ds-brand": accent, "--ds-brand-sky": accent, "--ds-on-brand": onAccent(accent) } as CSSProperties) : undefined;
  const hasDetails = search.details !== "0" && !!(org.phone || org.email || org.address || org.hours);

  const form = (
    <div className="space-y-4">
      {failed && <Notice tone="danger">Something was missing. Please check the form and send it again.</Notice>}
      <LeadForm orgId={org.id} company={org.name} submitted={submitted} />
    </div>
  );
  const aside = hasDetails && (
    <aside className="flex-1 basis-60 bg-raised p-6 md:p-8">
      <h2 className="text-heading font-semibold">Get in touch</h2>
      <p className="mb-6 mt-2 text-sm text-ink-muted">Prefer to talk? Reach {org.name} any of these ways.</p>
      <ContactInfo details={org} />
    </aside>
  );

  // Iframe mode: no page chrome, and the height is reported to the parent.
  if (search.embed === "1") {
    const theme = search.theme === "light" || search.theme === "dark" ? search.theme : undefined;
    return (
      <main style={style} className="p-1">
        <FrameResize theme={theme} />
        <div className="flex flex-wrap overflow-hidden rounded-lg border border-hairline bg-surface">
          {aside}
          <section className="flex-[2_1_20rem] p-6 md:p-8">{form}</section>
        </div>
      </main>
    );
  }

  return (
    <main style={style} className="mx-auto max-w-5xl px-4 py-10 md:py-16">
      <header className="mb-8 text-center">
        <h1 className="text-display font-semibold">Contact {org.name}</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">Tell us a bit about what you need and we&apos;ll get back to you fast.</p>
      </header>
      <div className="flex flex-wrap overflow-hidden rounded-xl border border-hairline bg-surface shadow-float">
        {aside}
        <section className="flex-[2_1_22rem] p-6 md:p-8">{form}</section>
      </div>
    </main>
  );
}
