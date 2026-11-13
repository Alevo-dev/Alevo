"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { SettingRow } from "@/components/ui/setting-row";
import { LeaveDialog, UnsavedBar, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { mergeImported, type ImportedProfile, type ImportMode } from "@/lib/profile/merge";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveBusinessProfile, type ActionState, type BusinessProfileErrors, type BusinessProfileValues } from "./actions";
import { ImportDialog } from "./import-dialog";

const INITIAL: ActionState = {};

/** Imported values waiting to be saved. Tied to the state they were made against, so the next save's echo wins. */
type Imported = { on: ActionState; values: BusinessProfileValues; note: string };

export function BusinessProfileForm({ initial, agentOn }: { initial: BusinessProfileValues; agentOn: boolean }) {
  const [state, action, pending] = useActionState(saveBusinessProfile, INITIAL);
  useActionToast(state, "Profile saved.");
  const { formRef, formKey, dirty, recheck, touch, discard, guard } = useUnsavedForm(state);

  const [importOpen, setImportOpen] = useState(false);
  const [importHasContent, setImportHasContent] = useState(false);
  const [imported, setImported] = useState<Imported | null>(null);
  const [importKey, setImportKey] = useState(0);
  const live = imported?.on === state ? imported : null;

  // Echo submitted values back on error; fall back to the saved profile. A fresh import wins over both.
  const v = <K extends keyof BusinessProfileValues>(key: K): BusinessProfileValues[K] =>
    (live?.values[key] ?? state.values?.[key] ?? initial[key]) as BusinessProfileValues[K];
  const e = (key: keyof BusinessProfileErrors) => state.errors?.[key];

  /** What is in the form right now, typed-but-unsaved edits included. */
  const readForm = (): BusinessProfileValues => {
    const fd = new FormData(formRef.current ?? undefined);
    return Object.fromEntries(Object.keys(initial).map((k) => [k, String(fd.get(k) ?? "")])) as BusinessProfileValues;
  };

  function openImport() {
    setImportHasContent(Object.values(readForm()).some((x) => x.trim()));
    setImportOpen(true);
  }

  function applyImport(found: ImportedProfile, mode: ImportMode) {
    const { values, filled } = mergeImported(readForm(), found, mode);
    if (filled.length === 0) return toast.info("Nothing new to fill in.");
    setImported({ on: state, values, note: `Filled ${filled.length} field${filled.length === 1 ? "" : "s"}. Review them, then save.` });
    setImportKey((k) => k + 1); // remount so the fields pick up the new defaults
    touch();
  }

  return (
    <>
    <form key={`${formKey}-${importKey}`} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck} className="space-y-6">
      <Card>
        <CardHeader
          aside={
            <Button type="button" size="sm" variant="secondary" onClick={openImport}>
              <Globe className="size-3.5" aria-hidden="true" />
              Import from website
            </Button>
          }
          title="Your business"
          hint={
            <>
              The agent grounds every reply in this. Company name, offering and ideal customer are required while the{" "}
              <Link href="/workspace/agent" className="underline underline-offset-2">agent</Link> is on{agentOn ? " (it is)" : ""}.
            </>
          }
        />
        {live && (
          <p role="status" className="mt-3 text-label text-ink-muted">
            {live.note}
          </p>
        )}
        <div className="mt-6">
          <SettingRow label="Company name" htmlFor="companyName" error={e("companyName")}>
            <Input id="companyName" name="companyName" defaultValue={v("companyName")} invalid={!!e("companyName")} placeholder="Northwind IT" />
          </SettingRow>
          <SettingRow
            label="Business address"
            htmlFor="businessAddress"
            hint="Printed in the footer of every email the agent sends (anti-spam law requires a postal address) and shown on your contact form."
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
        <CardHeader
          title="Contact details"
          hint="Shown beside your website contact form, next to the business address above. Leave any blank to hide it."
        />
        <div className="mt-6">
          <SettingRow label="Phone" htmlFor="contactPhone" hint="The number you want customers to call.">
            <Input id="contactPhone" name="contactPhone" type="tel" defaultValue={v("contactPhone")} placeholder="(614) 555-0100" maxLength={40} />
          </SettingRow>
          <SettingRow label="Email" htmlFor="contactEmail" hint="A public inbox, like hello@ or support@." error={e("contactEmail")}>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={v("contactEmail")}
              invalid={!!e("contactEmail")}
              placeholder="hello@northwind.it"
              maxLength={320}
            />
          </SettingRow>
          <SettingRow label="Opening hours" htmlFor="contactHours" hint="One line per day or range.">
            <Textarea
              id="contactHours"
              name="contactHours"
              rows={2}
              defaultValue={v("contactHours")}
              placeholder={"Mon to Fri, 8am to 6pm\nEmergency support 24/7"}
              maxLength={300}
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

      <UnsavedBar
        visible={dirty}
        pending={pending}
        error={state.error}
        onDiscard={() => {
          setImported(null);
          discard();
        }}
      />
      <LeaveDialog open={guard.pendingHref !== null} what="your business profile changes" onStay={guard.stay} onLeave={guard.leave} />
    </form>
    <ImportDialog open={importOpen} hasContent={importHasContent} onClose={() => setImportOpen(false)} onImported={applyImport} />
    </>
  );
}
