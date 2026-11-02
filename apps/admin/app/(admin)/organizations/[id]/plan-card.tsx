"use client";

import { useActionState, useState } from "react";
import { Button } from "@alevo/ui/button";
import { Card, CardHeader } from "@alevo/ui/card";
import { Notice } from "@alevo/ui/notice";
import { Select } from "@alevo/ui/select";
import type { PlanOption } from "@/lib/plans";
import { changePlan, type OrgActionState } from "../actions";

const INITIAL: OrgActionState = {};

/** The org's plan, one Select; Save appears when it changes. */
export function PlanCard({ orgId, planId, plans }: { orgId: string; planId: string | null; plans: PlanOption[] }) {
  const [state, action, pending] = useActionState(changePlan, INITIAL);
  const [dirty, setDirty] = useState(false);
  return (
    <Card>
      <CardHeader title="Plan" hint="Changing the plan changes the allowances at once; nothing is billed automatically." />
      <form action={action} onSubmit={() => setDirty(false)} className="mt-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="orgId" value={orgId} />
        <div className="w-56">
          <Select name="planId" options={plans.map((p) => ({ value: p.id, label: p.name }))} defaultValue={planId ?? undefined} placeholder="No plan" onChange={() => setDirty(true)} aria-label="Plan" />
        </div>
        {dirty && (
          <Button type="submit" variant="primary" size="sm" loading={pending}>
            Save
          </Button>
        )}
        {state.error && <Notice tone="danger">{state.error}</Notice>}
      </form>
    </Card>
  );
}
