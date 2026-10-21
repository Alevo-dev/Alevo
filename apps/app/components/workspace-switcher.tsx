"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { ChevronDown, Plus, Settings, Upload } from "lucide-react";
import { cx } from "@/lib/cx";
import { initials } from "@/lib/format";
import { toFormErrors, type FormErrors } from "@/components/auth/clerk-errors";
import { Button, Spinner } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Hint, Input, Label } from "@/components/ui/field";
import { Menu, type MenuItem } from "@/components/ui/menu";

const MAX_LOGO_BYTES = 10 * 1024 * 1024;

const NONE: FormErrors = { fields: {} };

/**
 * Our own workspace (organization) picker — Clerk data, Alevo surface, the
 * same shape as Clerk's switcher: active workspace on top, settings, the
 * other workspaces, create. Switching or creating resolves with a full
 * navigation to /dashboard so every server component re-reads the new org.
 */
export function WorkspaceSwitcher() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { isLoaded, userMemberships, setActive, createOrganization } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<FormErrors>(NONE);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Load every page up front; workspaces-per-user is a short list.
  useEffect(() => {
    if (isLoaded && userMemberships.hasNextPage && !userMemberships.isFetching) {
      void userMemberships.fetchNext();
    }
  }, [isLoaded, userMemberships]);

  async function open(orgId: string) {
    if (!isLoaded || orgId === organization?.id) return;
    setSwitching(true);
    setError(null);
    try {
      await setActive({ organization: orgId });
      // Full navigation on purpose: every server component and client cache
      // must re-read under the new org — a soft push can leave tenant state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch (err) {
      setError(toFormErrors(err).form ?? "Couldn't switch workspaces. Try again.");
      setSwitching(false);
    }
  }

  function pickLogo() {
    // Created on demand (never in the DOM) so the dialog's focus trap and
    // first-focus logic only ever see real controls.
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

  function closeCreate() {
    if (creating) return;
    setCreateOpen(false);
    setCreateErrors(NONE);
    setLogoError(null);
    setLogo(null);
    setLogoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded) return;
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return setCreateErrors({ fields: { name: "Give your workspace a name." } });
    setCreating(true);
    setCreateErrors(NONE);
    try {
      const org = await createOrganization({ name });
      if (logo) await org.setLogo({ file: logo }).catch(() => undefined); // the workspace exists; a failed logo shouldn't block it
      await setActive({ organization: org.id });
      // Full navigation on purpose — same reason as open().
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch (err) {
      setCreateErrors(toFormErrors(err));
      setCreating(false);
    }
  }

  const memberships = isLoaded ? userMemberships.data : [];
  const others: MenuItem[] = memberships
    .filter((m) => m.organization.id !== organization?.id)
    .map((m) => ({
      key: m.organization.id,
      label: m.organization.name,
      leading: (
        <WorkspaceAvatar name={m.organization.name} imageUrl={m.organization.hasImage ? m.organization.imageUrl : null} />
      ),
      onSelect: () => void open(m.organization.id),
    }));

  return (
    <>
      <Menu
        aria-label="Switch workspace"
        size="lg"
        disabled={!isLoaded || switching}
        buttonClassName="flex w-full items-center gap-2.5 rounded-sm bg-transparent px-2.5 py-1.5 text-left transition-colors hover:bg-raised"
        button={
          <>
            <WorkspaceAvatar
              name={organization?.name}
              imageUrl={organization?.hasImage ? organization.imageUrl : null}
              size="sm"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {organization?.name ?? (isLoaded ? "Select a workspace" : "…")}
            </span>
            {switching ? (
              <Spinner size="sm" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
            )}
          </>
        }
        header={
          organization && (
            <div className="flex min-w-0 items-center gap-2.5 py-1">
              <WorkspaceAvatar
                name={organization.name}
                imageUrl={organization.hasImage ? organization.imageUrl : null}
                size="lg"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{organization.name}</div>
                <div className="text-label text-ink-muted">Current workspace</div>
              </div>
            </div>
          )
        }
        groups={[
          [
            {
              key: "settings",
              label: "Workspace settings",
              icon: Settings,
              onSelect: () => router.push("/workspace/profile"),
            },
          ],
          others,
          [
            {
              key: "create",
              label: "Create workspace",
              leading: (
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm border border-dashed border-control text-ink-muted">
                  <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
              ),
              onSelect: () => setCreateOpen(true),
            },
          ],
        ]}
        menuClassName="w-108 max-w-[calc(100vw-16px)]"
      />
      {error && <p className="mt-1 text-label text-danger">{error}</p>}

      <Dialog open={createOpen} title="Create workspace" onClose={closeCreate} showClose>
        <form onSubmit={create} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Logo</Label>
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={pickLogo}
                aria-label="Upload a logo"
                className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-control bg-canvas transition-colors hover:bg-raised"
              >
                {logoUrl ? (
                  // Blob preview URL — next/image can't optimize it anyway.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo preview" className="size-full object-cover" />
                ) : (
                  <Upload className="size-5 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex gap-2">
                  <Button size="sm" onClick={pickLogo}>
                    {logo ? "Change" : "Upload"}
                  </Button>
                  {logo && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLogo(null);
                        setLogoUrl((old) => {
                          if (old) URL.revokeObjectURL(old);
                          return null;
                        });
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Hint>Recommended size 1:1, up to 10MB.</Hint>
                {logoError && <p className="text-label text-danger">{logoError}</p>}
              </div>
            </div>
          </div>

          <Field label="Name" htmlFor="new-workspace-name" error={createErrors.fields.name}>
            <Input
              id="new-workspace-name"
              name="name"
              placeholder="Workspace name"
              autoComplete="organization"
              invalid={!!createErrors.fields.name}
            />
          </Field>
          {createErrors.form && <p className="text-sm text-danger">{createErrors.form}</p>}
          <Button type="submit" variant="primary" loading={creating} className="self-end">
            {creating ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}

const AVATAR = {
  sm: { px: 24, box: "size-6", text: "text-[10px]" },
  md: { px: 28, box: "size-7", text: "text-xs" },
  lg: { px: 36, box: "size-9", text: "text-sm" },
} as const;

function WorkspaceAvatar({
  name,
  imageUrl,
  size = "md",
}: {
  name: string | undefined;
  imageUrl: string | null;
  size?: keyof typeof AVATAR;
}) {
  const { px, box, text } = AVATAR[size];
  if (imageUrl) {
    return <Image src={imageUrl} alt="" width={px} height={px} className={cx("shrink-0 rounded-sm object-cover", box)} />;
  }
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-sm font-semibold",
        box,
        text,
        name ? "bg-brand text-on-brand" : "bg-raised text-ink-muted",
      )}
    >
      {initials(name)}
    </span>
  );
}
