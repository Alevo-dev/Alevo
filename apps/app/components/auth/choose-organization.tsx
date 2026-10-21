"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useOrganizationList, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { initials } from "@/lib/format";
import { toFormErrors, type FormErrors } from "./clerk-errors";

const NONE: FormErrors = { fields: {} };

/**
 * Resolves Clerk's `choose-organization` session task: accept a pending
 * invitation, open an existing workspace, or create one. Reached after
 * sign-in / sign-up (any method) while the session is still pending.
 */
export function ChooseOrganization() {
  const router = useRouter();
  const clerk = useClerk();
  const { user } = useUser();
  const { isLoaded, userMemberships, userInvitations, createOrganization, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
    userInvitations: { infinite: true, status: "pending" },
  });
  const [errors, setErrors] = useState<FormErrors>(NONE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const autoOpened = useRef(false);

  const suggested =
    (user?.unsafeMetadata as { company?: string } | undefined)?.company ??
    (user?.firstName ? `${user.firstName}'s workspace` : "");

  const memberships = userMemberships?.data ?? [];
  const invitations = userInvitations?.data ?? [];
  const listsLoaded = isLoaded && !userMemberships?.isLoading && !userInvitations?.isLoading;

  async function finish() {
    // Selecting an org resolves the task; the session becomes active.
    if (clerk.session?.currentTask) {
      setErrors({ fields: {}, form: "Couldn't finish setting up the workspace. Try again." });
      return;
    }
    router.push("/dashboard");
  }

  async function open(orgId: string) {
    if (!isLoaded) return;
    setBusyId(orgId);
    setErrors(NONE);
    try {
      await setActive({ organization: orgId });
      await finish();
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setBusyId(null);
    }
  }

  async function accept(inv: (typeof invitations)[number]) {
    if (!isLoaded) return;
    setBusyId(inv.id);
    setErrors(NONE);
    try {
      await inv.accept();
      await setActive({ organization: inv.publicOrganizationData.id });
      await finish();
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setBusyId(null);
    }
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return setErrors({ fields: { name: "Give your workspace a name." } });
    setCreating(true);
    setErrors(NONE);
    try {
      const org = await createOrganization({ name });
      await setActive({ organization: org.id });
      await finish();
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setCreating(false);
    }
  }

  // Exactly one workspace and nothing else to decide: open it rather than ask.
  useEffect(() => {
    if (!listsLoaded || autoOpened.current) return;
    if (memberships.length === 1 && invitations.length === 0 && clerk.session?.currentTask) {
      autoOpened.current = true;
      const only = memberships[0]!.organization.id;
      queueMicrotask(() => void open(only));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once the lists have loaded
  }, [listsLoaded, memberships.length, invitations.length]);

  return (
    <div className="flex flex-col gap-7">
      {invitations.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-ink">You&apos;ve been invited to</h2>
          <ul className="mt-3 divide-y divide-hairline rounded-md border border-brand bg-brand-soft">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <OrgRow name={inv.publicOrganizationData.name} />
                <Button size="sm" variant="primary" loading={busyId === inv.id} disabled={busyId !== null} onClick={() => accept(inv)}>
                  Accept
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {memberships.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-ink">Your workspaces</h2>
          <ul className="mt-3 divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {memberships.map((m) => (
              <li key={m.organization.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <OrgRow name={m.organization.name} />
                <Button
                  size="sm"
                  variant={invitations.length ? "secondary" : "primary"}
                  loading={busyId === m.organization.id}
                  disabled={busyId !== null}
                  onClick={() => open(m.organization.id)}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={create} noValidate className="flex flex-col gap-4.5">
        {(memberships.length > 0 || invitations.length > 0) && (
          <h2 className="text-sm font-semibold text-ink">Or create a new one</h2>
        )}
        <Field label="Workspace name" htmlFor="org-name" hint="Usually your company name. You can rename it later." error={errors.fields.name}>
          <Input id="org-name" name="name" defaultValue={suggested} placeholder="Northbridge IT" autoComplete="organization" invalid={!!errors.fields.name} />
        </Field>
        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
        <Button type="submit" variant="primary" loading={creating} disabled={!isLoaded || busyId !== null} className="w-full">
          {creating ? "Creating…" : "Create workspace"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => clerk.signOut({ redirectUrl: "/sign-in" })}
        className="self-center text-sm font-medium text-link hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

function OrgRow({ name }: { name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-on-brand">
        {initials(name)}
      </span>
      <span className="truncate text-sm font-medium text-ink">{name}</span>
    </span>
  );
}
