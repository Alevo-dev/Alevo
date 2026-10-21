"use client";

import { useState } from "react";
import Image from "next/image";
import { useOrganization } from "@clerk/nextjs";
import { Upload } from "lucide-react";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { toast } from "@/lib/ui/use-action-toast";
import { deleteOrg, leaveOrg } from "@/app/(app)/workspace/org-actions";
import { AccountRow, LinkButton, Pane } from "@/components/account/rows";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Hint, Input, Label } from "@/components/ui/field";

const MAX_LOGO_BYTES = 10 * 1024 * 1024;

/** General workspace settings: profile (name + logo), leave, delete. */
export function GeneralTab() {
  const { organization, isLoaded } = useOrganization();
  const [editing, setEditing] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function leave() {
    setLeaving(true);
    const r = await leaveOrg();
    if (r.ok) {
      // Full navigation on purpose: no active org now → every server component and
      // client cache must re-read; the app then routes to org-selection.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
      return;
    }
    setLeaving(false);
    setLeaveOpen(false);
    toast.error(r.error ?? "Couldn't leave the workspace.");
  }

  async function remove() {
    setDeleting(true);
    const r = await deleteOrg();
    if (r.ok) {
      // Full navigation on purpose — the workspace is gone; reset all state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
      return;
    }
    setDeleting(false);
    setDeleteOpen(false);
    toast.error(r.error ?? "Couldn't delete the workspace.");
  }

  return (
    <Pane title="General">
      <AccountRow label="Workspace profile">
        {editing && organization ? (
          <ProfileEditor
            organization={organization}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <LogoTile name={organization?.name} imageUrl={organization?.hasImage ? organization.imageUrl : null} />
              <span className="truncate text-sm font-medium text-ink">
                {organization?.name ?? (isLoaded ? "—" : "…")}
              </span>
            </span>
            <LinkButton onClick={() => setEditing(true)} disabled={!organization}>
              Update profile
            </LinkButton>
          </div>
        )}
      </AccountRow>

      <AccountRow label="Leave workspace">
        <LinkButton danger onClick={() => setLeaveOpen(true)} disabled={!organization}>
          Leave workspace
        </LinkButton>
      </AccountRow>

      <AccountRow label="Delete workspace">
        <LinkButton danger onClick={() => setDeleteOpen(true)} disabled={!organization}>
          Delete workspace
        </LinkButton>
      </AccountRow>

      <ConfirmDialog
        open={leaveOpen}
        title="Leave this workspace?"
        description="You'll lose access right away. An admin can invite you back later."
        confirmLabel="Leave workspace"
        tone="danger"
        busy={leaving}
        onConfirm={leave}
        onCancel={() => setLeaveOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${organization?.name ?? "this workspace"}?`}
        description="This permanently deletes the workspace and everything in it — conversations, meetings, members, and settings. This can't be undone."
        confirmLabel="Delete workspace"
        tone="danger"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
      />
    </Pane>
  );
}

type Org = NonNullable<ReturnType<typeof useOrganization>["organization"]>;

/** Inline name + logo editor — Clerk mutations; the webhook mirrors to our DB. */
function ProfileEditor({ organization, onDone, onCancel }: { organization: Org; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(organization.name);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickLogo() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_LOGO_BYTES) return setLogoError("The logo must be 10MB or less.");
      setLogoError(null);
      setLogo(file);
      setLogoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
    };
    input.click();
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setNameError("Give your workspace a name.");
    setSaving(true);
    setNameError(null);
    try {
      if (trimmed !== organization.name) await organization.update({ name: trimmed });
      if (logo) await organization.setLogo({ file: logo });
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      toast.success("Workspace updated.");
      onDone();
    } catch {
      setSaving(false);
      setNameError("Couldn't save your changes. Try again.");
    }
  }

  const preview = logoUrl ?? (organization.hasImage ? organization.imageUrl : null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={pickLogo}
            aria-label="Upload a logo"
            className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-control bg-canvas transition-colors hover:bg-raised"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Logo preview" className="size-full object-cover" />
            ) : (
              <Upload className="size-5 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
          <div className="flex flex-col gap-1.5">
            <Button size="sm" onClick={pickLogo}>
              {organization.hasImage || logo ? "Change" : "Upload"}
            </Button>
            <Hint>Square image, up to 10MB.</Hint>
            {logoError && <p className="text-label text-danger">{logoError}</p>}
          </div>
        </div>
      </div>

      <Field label="Name" htmlFor="org-name" error={nameError ?? undefined}>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="organization"
          invalid={!!nameError}
        />
      </Field>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" loading={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LogoTile({ name, imageUrl }: { name: string | undefined; imageUrl: string | null }) {
  if (imageUrl) {
    return <Image src={imageUrl} alt="" width={36} height={36} className="size-9 shrink-0 rounded-md object-cover" />;
  }
  return (
    <span
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
        name ? "bg-brand text-on-brand" : "bg-raised text-ink-muted",
      )}
    >
      {initials(name)}
    </span>
  );
}
