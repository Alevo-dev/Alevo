"use client";

import { useActionState, useState } from "react";
import { ChevronRight, Globe } from "lucide-react";
import { toast } from "sonner";
import { LeaveDialog, useUnsavedForm } from "@/components/ui/unsaved-changes";
import { SaveBar } from "@/components/workspace/save-bar";
import { mergeImported, type ImportedProfile, type ImportMode } from "@/lib/profile/merge";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { saveBusinessProfile, type ActionState, type BusinessProfileErrors, type BusinessProfileValues } from "./actions";
import { ImportDialog } from "./import-dialog";
import { ProfileField } from "./profile-field";
import { ProfileToc, type TocItem } from "./profile-toc";

const INITIAL: ActionState = {};
const MAX = 600;

/** Imported values waiting to be saved. Tied to the state they were made against, so the next save's echo wins. */
type Imported = { on: ActionState; values: BusinessProfileValues; note: string };

/** One section of the profile (board `.sec2`): title and why on the left, its fields on the right. */
function Section({ id, title, why, children }: { id: string; title: string; why: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="grid scroll-mt-4 gap-3.5 border-t border-hairline/60 py-[26px] first:border-t-0 first:pt-1.5 md:gap-8 min-[981px]:grid-cols-[200px_minmax(0,1fr)]"
    >
      <div>
        <h2 className="font-display text-[15px] font-semibold leading-5 text-ink">{title}</h2>
        <p className="mt-1.5 text-[13.5px] leading-[18px] text-ink-muted">{why}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-[18px]">{children}</div>
    </section>
  );
}

export function BusinessProfileForm({ initial }: { initial: BusinessProfileValues }) {
  const [state, action, pending] = useActionState(saveBusinessProfile, INITIAL);
  useActionToast(state, "Profile saved.");
  const { formRef, formKey, dirty, recheck, touch, discard, guard, saveAndLeave } = useUnsavedForm(state);

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

  // A section is done when its required answers are in (saved values, not what is being typed).
  const toc: TocItem[] = [
    { id: "company", label: "Company", done: Boolean(initial.companyName && initial.offering) },
    { id: "icp", label: "Who you sell to", done: Boolean(initial.idealCustomer && initial.qualifyingCriteria) },
    { id: "contact", label: "Contact details", done: Boolean(initial.businessAddress && initial.contactEmail && initial.contactPhone && initial.contactHours) },
  ];

  return (
    <>
      <form key={`${formKey}-${importKey}`} ref={formRef} action={action} noValidate onInput={recheck} onChange={recheck}>
        <div className="grid items-start gap-10 min-[981px]:grid-cols-[minmax(0,1fr)_168px]">
          <div className="min-w-0 max-w-[820px]">
            <div className="flex flex-wrap items-center gap-2 pb-3.5 pt-0.5 text-ink-muted">
              <Globe className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
              <span>Fill this in from your website.</span>
              <button
                type="button"
                onClick={openImport}
                className="inline-flex items-center gap-1.5 rounded-xs font-[550] text-link outline-none hover:underline focus-visible:[box-shadow:var(--ds-focus-ring)]"
              >
                Import from website
                <ChevronRight className="size-[13px]" aria-hidden="true" />
              </button>
            </div>
            {live && (
              <p role="status" className="pb-3.5 text-label text-ink-muted">
                {live.note}
              </p>
            )}

            <Section id="company" title="Company" why="Used in every message and in the email footer.">
              <ProfileField name="companyName" label="Company name" required defaultValue={v("companyName")} error={e("companyName")} placeholder="Northwind IT" />
              <ProfileField name="website" label="Website" optional type="url" max={200} defaultValue={v("website")} error={e("website")} placeholder="northwind-it.com" hint="Used as the default for Import from website." />
              <ProfileField
                name="offering"
                label="What you offer"
                multiline
                required
                max={MAX}
                defaultValue={v("offering")}
                error={e("offering")}
                placeholder="Managed IT, cybersecurity and helpdesk for 20 to 200 seat businesses in the Midwest."
              />
            </Section>

            <Section id="icp" title="Who you sell to" why="The agent qualifies every lead against these three.">
              <ProfileField
                name="idealCustomer"
                label="Ideal client"
                multiline
                required
                max={MAX}
                defaultValue={v("idealCustomer")}
                error={e("idealCustomer")}
                placeholder="25 to 150 employees, no in-house IT, in healthcare, finance or legal, frustrated with slow support."
              />
              <ProfileField
                name="qualifyingCriteria"
                label="Qualifying criteria"
                multiline
                max={MAX}
                hint="What to confirm before handing a lead to a person."
                defaultValue={v("qualifyingCriteria")}
                placeholder="Company size, current IT setup, timeline, and who owns the decision."
              />
              <ProfileField
                name="disqualifiers"
                label="Disqualifiers"
                optional
                multiline
                max={MAX}
                hint="A lead that matches any of these is marked not a fit."
                defaultValue={v("disqualifiers")}
                placeholder="Individuals or home users, under 10 seats, or outside our service region."
              />
            </Section>

            <Section id="contact" title="Contact details" why="Public details and the postal address required in outbound email.">
              <div className="grid gap-[22px] md:grid-cols-2">
                <ProfileField
                  name="businessAddress"
                  label="Business address"
                  multiline
                  hint="Printed in every agent email footer"
                  defaultValue={v("businessAddress")}
                  error={e("businessAddress")}
                  placeholder="120 Main St, Suite 300, Columbus OH 43215"
                />
                <ProfileField name="contactHours" label="Hours" multiline max={300} defaultValue={v("contactHours")} placeholder="Mon to Fri, 8am to 6pm" />
                <ProfileField
                  name="contactEmail"
                  label="Public email"
                  type="email"
                  max={320}
                  hint="Shown beside the contact form"
                  defaultValue={v("contactEmail")}
                  error={e("contactEmail")}
                  placeholder="hello@northwind.it"
                />
                <ProfileField name="contactPhone" label="Public phone" type="tel" max={40} defaultValue={v("contactPhone")} placeholder="(614) 555-0100" />
              </div>
            </Section>
          </div>
          <ProfileToc items={toc} />
        </div>

        <SaveBar
          visible={dirty}
          pending={pending}
          error={state.error}
          onDiscard={() => {
            setImported(null);
            discard();
          }}
        />
        <LeaveDialog open={guard.pendingHref !== null} what="your business profile changes" onStay={guard.stay} onLeave={guard.leave} onSave={saveAndLeave} />
      </form>
      <ImportDialog open={importOpen} hasContent={importHasContent} onClose={() => setImportOpen(false)} onImported={applyImport} defaultUrl={v("website")} />
    </>
  );
}
