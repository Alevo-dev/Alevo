import { auth } from "@clerk/nextjs/server";
import { getCurrentOrg, getCurrentUser } from "@alevo/auth";

// Reads the session + DB, so it must render per-request.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { orgId } = await auth();

  // Signed in but no active org yet — prompt them to create/select one.
  if (!orgId) {
    return (
      <section className="mx-auto max-w-md text-center">
        <h1 className="text-2xl">Create your organization</h1>
        <p className="mt-2 text-muted-foreground">
          Use the organization switcher in the header to create your workspace.
        </p>
      </section>
    );
  }

  // Both reads prove the full loop: Clerk session → our mirrored tables → RLS.
  const [org, user] = await Promise.all([getCurrentOrg(), getCurrentUser()]);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Platform foundation is live. The data below came through row-level
          security, scoped to your organization.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-5 text-sm">
        <dt className="text-muted-foreground">Organization</dt>
        <dd>{org?.name ?? "— (webhook not yet mirrored)"}</dd>
        <dt className="text-muted-foreground">Org id (ours)</dt>
        <dd className="font-mono text-xs">{org?.id ?? "—"}</dd>
        <dt className="text-muted-foreground">Signed in as</dt>
        <dd>{user?.email ?? "—"}</dd>
        <dt className="text-muted-foreground">Platform admin</dt>
        <dd>{user?.isPlatformAdmin ? "yes" : "no"}</dd>
      </dl>
    </section>
  );
}
