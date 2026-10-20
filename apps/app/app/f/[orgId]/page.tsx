import { eq } from "drizzle-orm";
import { organizations, withService } from "@alevo/db";
import { Card } from "@/components/ui/card";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";

export default async function LeadFormPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const [org] = await withService((tx) =>
    tx
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1),
  );

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
