"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useClerk, useOrganization } from "@clerk/nextjs";
import { Check, Copy, Upload } from "lucide-react";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { nextWorkspace } from "@/lib/orgs/next-workspace";
import { toast } from "@/lib/ui/use-action-toast";
import { deleteOrg, leaveOrg, loadOrgIdentity } from "@/app/(app)/workspace/org-actions";
import { AccountRow, LinkButton } from "@/components/account/rows";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Hint, Input, Label } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";

const MAX_LOGO_BYTES = 10 * 1024 * 1024;

/** General workspace settings: profile (name + logo), leave, delete. Only admins and owners edit or delete; anyone may leave. */
export function GeneralTab({ canEdit }: { canEdit: boolean }) {
  const clerk = useClerk();
  const { organization, isLoaded } = useOrganization();
  const [editing, setEditing] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * After leaving or deleting: open another workspace of theirs, or sign out when
   * there is none. The session token still names the old org for up to a minute,
   * so a bare reload would draw the stale shell; `setActive` refreshes it first.
   * Full navigation on purpose — every server component must re-read the new org.
   */
  async function moveOn(leftId: string) {
    try {
      const { data } = (await clerk.user?.getOrganizationMemberships()) ?? { data: [] };
      const next = nextWorkspace(data, leftId);
      if (!next) return void clerk.signOut({ redirectUrl: "/sign-in" });
      await clerk.setActive({ organization: next });
    } catch {
      // Fall through: the reload below still lands on the picker.
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dashboard");
  }

  async function leave() {
    if (!organization) return;
    setLeaving(true);
    const r = await leaveOrg();
    if (r.ok) return moveOn(organization.id);
    setLeaving(false);
    setLeaveOpen(false);
    toast.error(r.error ?? "Couldn't leave the workspace.");
  }

  async function remove() {
    if (!organization) return;
    setDeleting(true);
    const r = await deleteOrg();
    if (r.ok) return moveOn(organization.id);
    setDeleting(false);
    setDeleteOpen(false);
    toast.error(r.error ?? "Couldn't delete the workspace.");
  }

  return (
    <Card>
      <CardHeader title="General" />
      <div className="mt-2 divide-y divide-hairline">
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
            {canEdit && (
              <LinkButton onClick={() => setEditing(true)} disabled={!organization}>
                Update profile
              </LinkButton>
            )}
          </div>
        )}
      </AccountRow>

      <AccountRow label="Workspace ID">
        <WorkspaceId />
      </AccountRow>

      <AccountRow label="Leave workspace">
        <LinkButton danger onClick={() => setLeaveOpen(true)} disabled={!organization}>
          Leave workspace
        </LinkButton>
      </AccountRow>

      {canEdit && (
        <AccountRow label="Delete workspace">
          <LinkButton danger onClick={() => setDeleteOpen(true)} disabled={!organization}>
            Delete workspace
          </LinkButton>
        </AccountRow>
      )}
      </div>

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
    </Card>
  );
}

type Org = NonNullable<ReturnType<typeof useOrganization>["organization"]>;

/**
 * The Alevo workspace id (our uuid), read through a server action because the
 * dialog otherwise only sees Clerk's organization. Copyable: it is the `data-org`
 * value in the website form and chat widget snippets.
 */
function WorkspaceId() {
  const [id, setId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Set state from the resolved promise, and ignore a late result after unmount.
  useEffect(() => {
    let active = true;
    void loadOrgIdentity().then((r) => {
      if (!active) return;
      if ("id" in r) setId(r.id);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function copy() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <code className="min-w-0 truncate rounded-sm bg-raised px-2 py-1 font-mono text-sm text-ink">
          {id ?? (failed ? "Unavailable" : "…")}
        </code>
        <IconButton aria-label="Copy workspace ID" onClick={copy} disabled={!id}>
          {copied ? (
            <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </IconButton>
      </div>
      <Hint>The data-org value in your website form and chat widget snippets.</Hint>
    </div>
  );
}

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
