"use client";

import { useActionState, useRef, useState } from "react";
import { Card, CardHeader } from "@alevo/ui/card";
import { Notice } from "@alevo/ui/notice";
import { SaveBar } from "@alevo/ui/save-bar";
import { Select } from "@alevo/ui/select";
import { LeaveDialog, useLeaveGuard, useSaveAndLeave } from "@alevo/ui/unsaved-changes";
import type { PlanOption } from "@/lib/plans";
import { changePlan, type OrgActionState } from "../actions";

const INITIAL: OrgActionState = {};

/** The org's plan, one Select; Save appears when it changes. */
export function PlanCard({ orgId, planId, plans }: { orgId: string; planId: string | null; plans: PlanOption[] }) {
  const [state, action, pending] = useActionState(changePlan, INITIAL);
  const [dirty, setDirty] = useState(false);
  // Bumped by Discard: remounts the Select so it shows the saved plan again.
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useLeaveGuard(dirty);
  const saveAndLeave = useSaveAndLeave(guard, formRef, state);
  return (
    <Card>
      <CardHeader title="Plan" hint="Changing the plan changes the allowances at once; nothing is billed automatically." />
      <form ref={formRef} action={action} onSubmit={() => setDirty(false)} className="mt-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="orgId" value={orgId} />
        <div className="w-56">
          <Select key={formKey} name="planId" options={plans.map((p) => ({ value: p.id, label: p.name }))} defaultValue={planId ?? undefined} placeholder="No plan" onChange={() => setDirty(true)} aria-label="Plan" />
        </div>
        <SaveBar
          visible={dirty}
          pending={pending}
          error={state.error}
          onDiscard={() => {
            setFormKey((k) => k + 1);
            setDirty(false);
          }}
        />
        <LeaveDialog open={guard.pendingHref !== null} what="the plan change" onStay={guard.stay} onLeave={guard.leave} onSave={saveAndLeave} />
      </form>
    </Card>
  );
}
