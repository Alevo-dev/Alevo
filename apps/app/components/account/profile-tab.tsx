"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { toFormErrors, type FormErrors } from "@/components/auth/clerk-errors";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { AccountRow, DotMenu, LinkButton, Pane } from "./rows";

const NONE: FormErrors = { fields: {} };

type User = NonNullable<ReturnType<typeof useUser>["user"]>;
type EmailRes = User["emailAddresses"][number];
type Confirm = { title: string; description: ReactNode; label: string; run: () => Promise<void> };

/** "Profile details": profile, email addresses, connected accounts. */
export function ProfileTab() {
  const { user } = useUser();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  if (!user) return null;

  return (
    <Pane title="Profile details">
      <AccountRow label="Profile">
        <ProfileSection user={user} />
      </AccountRow>
      <AccountRow label="Email addresses">
        <EmailSection user={user} setConfirm={setConfirm} />
      </AccountRow>
      <AccountRow label="Connected accounts">
        <ConnectedSection user={user} setConfirm={setConfirm} />
      </AccountRow>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.label ?? "Remove"}
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          setConfirmBusy(true);
          try {
            await confirm.run();
            setConfirm(null);
          } catch (err) {
            toast.error(toFormErrors(err).form ?? "Something went wrong. Try again.");
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </Pane>
  );
}

/* ── Profile (photo + name) ──────────────────────────────────────────────── */

function ProfileSection({ user }: { user: User }) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(NONE);
  const name = user.fullName || user.primaryEmailAddress?.emailAddress;

  function pickPhoto() {
    // Created on demand (never in the DOM) so the dialog's focus trap and
    // first-focus logic only ever see real controls.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        await user.setProfileImage({ file });
        toast.success("Photo updated.");
      } catch (err) {
        toast.error(toFormErrors(err).form ?? "Couldn't update the photo.");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const firstName = String(data.get("firstName") ?? "").trim();
    const lastName = String(data.get("lastName") ?? "").trim();
    if (!firstName) return setErrors({ fields: { name: "Enter your name." } });
    setSaving(true);
    setErrors(NONE);
    try {
      await user.update({ firstName, lastName });
      toast.success("Profile saved.");
      setEditing(false);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="flex min-w-0 items-center gap-3">
          <Avatar user={user} />
          <span className="truncate text-sm font-medium text-ink">{name}</span>
        </span>
        <LinkButton onClick={() => setEditing(true)}>Update profile</LinkButton>
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4.5">
      <div className="flex items-center gap-4">
        <Avatar user={user} />
        <div className="flex gap-2">
          <Button size="sm" loading={uploading} onClick={pickPhoto}>
            {user.hasImage ? "Change photo" : "Add photo"}
          </Button>
          {user.hasImage && (
            <IconButton
              tone="danger"
              aria-label="Remove photo"
              disabled={uploading}
              onClick={async () => {
                setUploading(true);
                try {
                  await user.setProfileImage({ file: null });
                  toast.success("Photo removed.");
                } catch (err) {
                  toast.error(toFormErrors(err).form ?? "Couldn't remove the photo.");
                } finally {
                  setUploading(false);
                }
              }}
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor="account-first" error={errors.fields.name}>
          <Input id="account-first" name="firstName" defaultValue={user.firstName ?? ""} autoComplete="given-name" invalid={!!errors.fields.name} />
        </Field>
        <Field label="Last name" htmlFor="account-last">
          <Input id="account-last" name="lastName" defaultValue={user.lastName ?? ""} autoComplete="family-name" />
        </Field>
      </div>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" loading={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function Avatar({ user }: { user: User }) {
  if (user.hasImage) {
    return <Image src={user.imageUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand">
      {initials(user.fullName || user.primaryEmailAddress?.emailAddress)}
    </span>
  );
}

/* ── Email addresses ─────────────────────────────────────────────────────── */

type AddState = null | { stage: "email" } | { stage: "code"; target: EmailRes };

function EmailSection({ user, setConfirm }: { user: User; setConfirm: (c: Confirm) => void }) {
  const [addState, setAddState] = useState<AddState>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(NONE);

  function reset() {
    setAddState(null);
    setErrors(NONE);
  }

  async function sendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return setErrors({ fields: { email: "Enter an email address." } });
    setBusy(true);
    setErrors(NONE);
    try {
      const created = await user.createEmailAddress({ email });
      await created.prepareVerification({ strategy: "email_code" });
      setAddState({ stage: "code", target: created });
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (addState?.stage !== "code") return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    if (!code) return setErrors({ fields: { code: "Enter the code we sent." } });
    setBusy(true);
    setErrors(NONE);
    try {
      await addState.target.attemptVerification({ code });
      toast.success("Email address verified.");
      reset();
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setBusy(false);
    }
  }

  async function startVerify(email: EmailRes) {
    setErrors(NONE);
    try {
      await email.prepareVerification({ strategy: "email_code" });
      setAddState({ stage: "code", target: email });
    } catch (err) {
      toast.error(toFormErrors(err).form ?? "Couldn't send the code. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {user.emailAddresses.map((email) => {
        const primary = email.id === user.primaryEmailAddressId;
        const verified = email.verification?.status === "verified";
        const items = [
          ...(!primary && verified
            ? [
                {
                  key: "primary",
                  label: "Set as primary",
                  onSelect: async () => {
                    try {
                      await user.update({ primaryEmailAddressId: email.id });
                      toast.success("Primary email updated.");
                    } catch (err) {
                      toast.error(toFormErrors(err).form ?? "Couldn't update the primary email.");
                    }
                  },
                },
              ]
            : []),
          ...(!verified ? [{ key: "verify", label: "Verify email", onSelect: () => void startVerify(email) }] : []),
          ...(!primary
            ? [
                {
                  key: "remove",
                  label: "Remove email",
                  danger: true,
                  onSelect: () =>
                    setConfirm({
                      title: "Remove this email address?",
                      description: `${email.emailAddress} will no longer be attached to your account.`,
                      label: "Remove email",
                      run: async () => {
                        await email.destroy();
                        toast.success("Email address removed.");
                      },
                    }),
                },
              ]
            : []),
        ];
        return (
          <div key={email.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm text-ink">{email.emailAddress}</span>
              {primary && <Pill tone="muted">Primary</Pill>}
              {!verified && <Pill tone="warning">Unverified</Pill>}
            </span>
            {items.length > 0 && <DotMenu label={`Options for ${email.emailAddress}`} items={items} />}
          </div>
        );
      })}

      {addState === null && (
        <LinkButton onClick={() => setAddState({ stage: "email" })} className="flex items-center gap-1.5 self-start">
          <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Add email address
        </LinkButton>
      )}

      {addState?.stage === "email" && (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas/40 p-4">
          <Field label="Email address" htmlFor="account-new-email" error={errors.fields.email} hint="We'll send a verification code to this address.">
            <Input id="account-new-email" name="email" type="email" autoComplete="email" invalid={!!errors.fields.email} />
          </Field>
          {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={busy} onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={busy}>
              {busy ? "Sending…" : "Send code"}
            </Button>
          </div>
        </form>
      )}

      {addState?.stage === "code" && (
        <form onSubmit={verifyCode} noValidate className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas/40 p-4">
          <Field
            label="Verification code"
            htmlFor="account-email-code"
            error={errors.fields.code}
            hint={`Enter the code we sent to ${addState.target.emailAddress}.`}
          >
            <Input id="account-email-code" name="code" inputMode="numeric" autoComplete="one-time-code" invalid={!!errors.fields.code} />
          </Field>
          {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={busy} onClick={reset}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={busy}>
              {busy ? "Verifying…" : "Verify"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Connected accounts ──────────────────────────────────────────────────── */

function ConnectedSection({ user, setConfirm }: { user: User; setConfirm: (c: Confirm) => void }) {
  const accounts = user.externalAccounts;
  if (accounts.length === 0) {
    return <p className="text-sm text-ink-muted">No connected accounts.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {accounts.map((account) => {
        const provider = account.provider.charAt(0).toUpperCase() + account.provider.slice(1);
        const connected = account.verification?.status === "verified";
        return (
          <div key={account.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                {account.provider === "google" && <GoogleMark />}
                <span className="text-sm font-medium text-ink">{provider}</span>
                {account.emailAddress && (
                  <span className="truncate text-sm text-ink-muted">• {account.emailAddress}</span>
                )}
              </span>
              {!connected && (
                <p className="mt-1 text-sm text-ink-muted">
                  This account has been disconnected.{" "}
                  <LinkButton
                    onClick={async () => {
                      try {
                        const res = await account.reauthorize({ redirectUrl: window.location.href });
                        const url = res.verification?.externalVerificationRedirectURL;
                        if (url) window.location.href = url.href;
                      } catch (err) {
                        toast.error(toFormErrors(err).form ?? "Couldn't reconnect. Try again.");
                      }
                    }}
                  >
                    Reconnect
                  </LinkButton>
                </p>
              )}
            </div>
            <DotMenu
              label={`Options for ${provider}`}
              items={[
                {
                  key: "remove",
                  label: "Remove connection",
                  danger: true,
                  onSelect: () =>
                    setConfirm({
                      title: `Disconnect ${provider}?`,
                      description: `You'll no longer be able to sign in with this ${provider} account.`,
                      label: "Disconnect",
                      run: async () => {
                        await account.destroy();
                        toast.success(`${provider} disconnected.`);
                      },
                    }),
                },
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}

/** The multicolour Google "G". */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.2 17.2C3.1 21.2 7.2 24 12 24z" />
      <path fill="#FBBC05" d="M5.1 14.3c-.3-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.2 6.8C.4 8.4 0 10.1 0 12s.4 3.6 1.2 5.2l3.9-2.9z" />
      <path fill="#EA4335" d="M12 4.6c2.3 0 3.8 1 4.7 1.8L20 3.2C18 1.2 15.2 0 12 0 7.2 0 3.1 2.8 1.2 6.8l3.9 2.9c1-3 3.7-5.1 6.9-5.1z" />
    </svg>
  );
}
