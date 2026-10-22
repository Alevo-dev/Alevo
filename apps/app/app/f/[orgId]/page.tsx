import type { Metadata } from "next";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { organizations, withService } from "@alevo/db";
import { Card } from "@/components/ui/card";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";

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

export default async function LeadFormPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const org = await loadOrg(orgId);

  if (!org) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
        <p className="text-ink-muted">This form is not available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 md:py-16">
      <Card>
        <h1 className="text-heading font-semibold">Contact {org.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Tell us a bit about what you need and we&apos;ll get back to you fast.
        </p>
        <div className="mt-6">
          <LeadForm orgId={org.id} />
        </div>
      </Card>
    </main>
  );
}
