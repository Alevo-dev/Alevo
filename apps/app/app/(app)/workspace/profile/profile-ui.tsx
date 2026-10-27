"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { SettingRow } from "@/components/ui/setting-row";
import { LeaveDialog, UnsavedBar, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveBusinessProfile, type ActionState, type BusinessProfileErrors, type BusinessProfileValues } from "./actions";

const INITIAL: ActionState = {};

export function BusinessProfileForm({ initial, agentOn }: { initial: BusinessProfileValues; agentOn: boolean }) {
  const [state, action, pending] = useActionState(saveBusinessProfile, INITIAL);
  useActionToast(state, "Business profile saved.");
  const { formRef, formKey, dirty, recheck, discard, guard } = useUnsavedForm(state);

  // Echo submitted values back on error; fall back to the saved profile.
  const v = <K extends keyof BusinessProfileValues>(key: K): BusinessProfileValues[K] =>
    (state.values?.[key] ?? initial[key]) as BusinessProfileValues[K];
  const e = (key: keyof BusinessProfileErrors) => state.errors?.[key];

  return (
    <form key={formKey} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck} className="space-y-6">
      <Card>
        <CardHeader
          title="Your business"
          hint={
            <>
              The agent grounds every reply in this. Company name, offering and ideal customer are required while the{" "}
              <Link href="/workspace/agent">agent</Link> is on{agentOn ? " (it is)" : ""}.
            </>
          }
        />
        <div className="mt-6">
          <SettingRow label="Company name" htmlFor="companyName" error={e("companyName")}>
            <Input id="companyName" name="companyName" defaultValue={v("companyName")} invalid={!!e("companyName")} placeholder="Northwind IT" />
          </SettingRow>
          <SettingRow
            label="Business address"
            htmlFor="businessAddress"
            hint="Printed in the footer of every email the agent sends. Anti-spam law requires a postal address."
            error={e("businessAddress")}
          >
            <Textarea
              id="businessAddress"
              name="businessAddress"
              rows={2}
              defaultValue={v("businessAddress")}
              invalid={!!e("businessAddress")}
              placeholder="120 Main St, Suite 300, Columbus OH 43215"
            />
          </SettingRow>
          <SettingRow label="What you offer" htmlFor="offering" hint="What you sell or do." error={e("offering")}>
            <Textarea
              id="offering"
              name="offering"
              rows={3}
              defaultValue={v("offering")}
              invalid={!!e("offering")}
              placeholder="Managed IT, cybersecurity and helpdesk for 20 to 200 seat businesses in the Midwest."
            />
          </SettingRow>
          <SettingRow label="Ideal customer" htmlFor="idealCustomer" hint="Who's a great fit: size, industry, pain points." error={e("idealCustomer")}>
            <Textarea
              id="idealCustomer"
              name="idealCustomer"
              rows={3}
              defaultValue={v("idealCustomer")}
              invalid={!!e("idealCustomer")}
              placeholder="25 to 150 employees, no in-house IT, in healthcare, finance or legal, frustrated with slow support."
            />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader title="How the agent qualifies" hint="What it confirms, and what rules a lead out." />
        <div className="mt-6">
          <SettingRow label="Qualifying criteria" htmlFor="qualifyingCriteria" hint="What to confirm before handing a lead to a person.">
            <Textarea
              id="qualifyingCriteria"
              name="qualifyingCriteria"
              rows={3}
              defaultValue={v("qualifyingCriteria")}
              placeholder="Company size, current IT setup, timeline, and who owns the decision."
            />
          </SettingRow>
          <SettingRow label="Disqualifiers" htmlFor="disqualifiers" hint="A lead that matches any of these is marked not a fit.">
            <Textarea
              id="disqualifiers"
              name="disqualifiers"
              rows={2}
              defaultValue={v("disqualifiers")}
              placeholder="Individuals or home users, under 10 seats, or outside our service region."
            />
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader title="Voice" hint="How the agent sounds and signs off." />
        <div className="mt-6">
          <SettingRow label="Tone and voice" htmlFor="tone">
            <Input id="tone" name="tone" defaultValue={v("tone")} placeholder="Friendly, concise, no jargon." />
          </SettingRow>
          <SettingRow label="Sign off as" htmlFor="signoff">
            <Input id="signoff" name="signoff" defaultValue={v("signoff")} placeholder="Sam from Northwind IT" />
          </SettingRow>
        </div>
      </Card>

      <UnsavedBar visible={dirty} pending={pending} error={state.error} onDiscard={discard} />
      <LeaveDialog open={guard.pendingHref !== null} what="your business profile changes" onStay={guard.stay} onLeave={guard.leave} />
    </form>
  );
}
