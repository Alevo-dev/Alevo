"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@alevo/ui/button";
import { Dialog } from "@alevo/ui/dialog";
import { Field, Input } from "@alevo/ui/field";
import { Notice } from "@alevo/ui/notice";
import { Select } from "@alevo/ui/select";
import type { PlanOption } from "@/lib/plans";
import { createOrganization, type NewOrgState } from "./actions";

const INITIAL: NewOrgState = {};

/** "New organization" button + the dialog: name, owner email, plan. Success redirects to the org page. */
export function NewOrgDialogButton({ plans }: { plans: PlanOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
        New organization
      </Button>
      {open && <NewOrgDialog plans={plans} onClose={() => setOpen(false)} />}
    </>
  );
}

function NewOrgDialog({ plans, onClose }: { plans: PlanOption[]; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createOrganization, INITIAL);
  const starter = plans.find((p) => p.key === "starter") ?? plans[0];
  const options = plans.map((p) => ({ value: p.id, label: p.name }));

  // Created but with something to read (invite failed / mirror slow): show it, then let them continue.
  if (state.ok && state.notice) {
    return (
      <Dialog
        open
        title="Workspace created"
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={() => (state.orgId ? router.push(`/organizations/${state.orgId}`) : onClose())}>
            {state.orgId ? "Open organization" : "Done"}
          </Button>
        }
      >
        <Notice tone="warning">{state.notice}</Notice>
      </Dialog>
    );
  }

  return (
    <Dialog open title="New organization" description="Creates the workspace, invites its owner, and adds you as Alevo support." onClose={onClose}>
      <form id="new-org" action={action} noValidate className="space-y-5">
        <Field label="Workspace name" htmlFor="org-name" error={state.errors?.name}>
          <Input id="org-name" name="name" defaultValue={state.values?.name} invalid={!!state.errors?.name} placeholder="Northwind IT" autoFocus />
        </Field>
        <Field label="Owner email" htmlFor="org-email" hint="They get the invite; they become the workspace's owner." error={state.errors?.email}>
          <Input id="org-email" name="email" type="email" inputMode="email" defaultValue={state.values?.email} invalid={!!state.errors?.email} placeholder="owner@company.com" />
        </Field>
        <Field label="Plan" htmlFor="org-plan">
          <Select id="org-plan" name="planId" options={options} defaultValue={state.values?.planId ?? starter?.id} />
        </Field>
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {pending ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
