import { eq } from "drizzle-orm";
import { organizations, withService } from "@alevo/db";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";

export default async function LeadFormPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const [org] = await withService((tx) =>
    tx.select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1),
  );

  if (!org) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
        <p className="text-muted-foreground">This form is not available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl">Contact {org.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us a bit about what you need and we&apos;ll get back to you fast.
        </p>
      </div>
      <LeadForm orgId={org.id} />
    </main>
  );
}
