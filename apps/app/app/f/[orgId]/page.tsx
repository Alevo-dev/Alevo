import type { Metadata } from "next";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { organizations, withService } from "@alevo/db";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { FrameResize } from "./frame-resize";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";

type Search = {
  embed?: string;
  theme?: string;
  submitted?: string;
  error?: string;
};

/** Deduped per request: generateMetadata and the page both ask for it. */
const loadOrg = cache(async (orgId: string) => {
  const [org] = await withService((tx) =>
    tx.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, orgId)).limit(1),
  );
  return org ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ orgId: string }> }): Promise<Metadata> {
  const org = await loadOrg((await params).orgId);
  return { title: org ? `Contact ${org.name}` : "Contact form" };
}

export default async function LeadFormPage({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<Search> }) {
  const [{ orgId }, search] = await Promise.all([params, searchParams]);
  const org = await loadOrg(orgId);

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

  // Iframe mode: just the form, no page chrome, and the height reported to the parent.
  if (search.embed === "1") {
    const theme = search.theme === "light" || search.theme === "dark" ? search.theme : undefined;
    return (
      <main className="p-1">
        <FrameResize theme={theme} />
        {failed && <Notice tone="danger">Something was missing. Please check the form and send it again.</Notice>}
        <LeadForm orgId={org.id} company={org.name} submitted={submitted} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 md:py-16">
      <Card>
        <h1 className="text-heading font-semibold">Contact {org.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">Tell us a bit about what you need and we&apos;ll get back to you fast.</p>
        <div className="mt-6 space-y-4">
          {failed && <Notice tone="danger">Something was missing. Please check the form and send it again.</Notice>}
          <LeadForm orgId={org.id} company={org.name} submitted={submitted} />
        </div>
      </Card>
    </main>
  );
}
