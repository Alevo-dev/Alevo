"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { toFormErrors, type FormErrors } from "@/components/auth/clerk-errors";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { AccountRow, DotMenu, LinkButton, Pane } from "./rows";

const NONE: FormErrors = { fields: {} };

type User = NonNullable<ReturnType<typeof useUser>["user"]>;
type SessionRes = Awaited<ReturnType<User["getSessions"]>>[number];
type Confirm = { title: string; description: ReactNode; label: string; run: () => Promise<void> };

/** "Security": password, active devices, delete account. */
export function SecurityTab({ onDeleted }: { onDeleted: () => void }) {
  const { user } = useUser();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  if (!user) return null;

  return (
    <Pane title="Security">
      <AccountRow label="Password">
        <PasswordSection user={user} />
      </AccountRow>
      <AccountRow label="Active devices">
        <DevicesSection user={user} setConfirm={setConfirm} />
      </AccountRow>
      <AccountRow label="Delete account">
        <LinkButton
          danger
          onClick={() =>
            setConfirm({
              title: "Delete your account?",
              description:
                "This permanently deletes your account and removes you from every workspace. This cannot be undone.",
              label: "Delete account",
              run: async () => {
                await user.delete();
                onDeleted();
                // Full navigation: the session is gone.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign("/sign-in");
              },
            })
          }
        >
          Delete account
        </LinkButton>
      </AccountRow>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.label ?? "Confirm"}
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

/* ── Password ────────────────────────────────────────────────────────────── */

function PasswordSection({ user }: { user: User }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(NONE);
  const hasPassword = user.passwordEnabled;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const fields: FormErrors["fields"] = {};
    if (hasPassword && !currentPassword) fields.currentPassword = "Enter your current password.";
    if (!newPassword) fields.newPassword = "Enter a new password.";
    if (Object.keys(fields).length) return setErrors({ fields });
    setSaving(true);
    setErrors(NONE);
    try {
      await user.updatePassword(hasPassword ? { currentPassword, newPassword } : { newPassword });
      toast.success(hasPassword ? "Password updated." : "Password set.");
      setEditing(false);
    } catch (err) {
      setErrors(toFormErrors(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-4">
        {hasPassword && <span className="text-sm tracking-widest text-ink">••••••••••</span>}
        <LinkButton onClick={() => setEditing(true)}>{hasPassword ? "Change password" : "Set password"}</LinkButton>
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate className="flex max-w-sm flex-col gap-4.5">
      {hasPassword && (
        <Field label="Current password" htmlFor="account-pw-current" error={errors.fields.currentPassword}>
          <Input
            id="account-pw-current"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.fields.currentPassword}
          />
        </Field>
      )}
      <Field
        label="New password"
        htmlFor="account-pw-new"
        error={errors.fields.newPassword ?? errors.fields.password}
      >
        <Input
          id="account-pw-new"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!(errors.fields.newPassword ?? errors.fields.password)}
        />
      </Field>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" loading={saving}>
          {saving ? "Saving…" : hasPassword ? "Update password" : "Set password"}
        </Button>
      </div>
    </form>
  );
}

/* ── Active devices ──────────────────────────────────────────────────────── */

function DevicesSection({ user, setConfirm }: { user: User; setConfirm: (c: Confirm) => void }) {
  const { session: current } = useSession();
  const [sessions, setSessions] = useState<SessionRes[] | null>(null);

  useEffect(() => {
    let on = true;
    user
      .getSessions()
      .then((list) => {
        if (on) setSessions(list);
      })
      .catch(() => {
        if (on) setSessions([]);
      });
    return () => {
      on = false;
    };
  }, [user]);

  if (sessions === null) return <p className="text-sm text-ink-muted">Loading devices…</p>;
  if (sessions.length === 0) return <p className="text-sm text-ink-muted">No active devices.</p>;

  return (
    <div className="flex flex-col gap-5">
      {sessions.map((session) => {
        const a = session.latestActivity;
        const isCurrent = session.id === current?.id;
        const Icon = a?.isMobile ? Smartphone : Monitor;
        const where = [a?.ipAddress, [a?.city, a?.country].filter(Boolean).join(", ")]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={session.id} className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-sm border border-hairline bg-canvas text-ink-muted">
                <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{a?.deviceType || (a?.isMobile ? "Mobile" : "Desktop")}</span>
                  {isCurrent && <Pill tone="muted">This device</Pill>}
                </span>
                <div className="mt-1 flex flex-col gap-0.5 text-ink-muted">
                  {a?.browserName && (
                    <span>
                      {a.browserName} {a.browserVersion}
                    </span>
                  )}
                  {where && <span className="font-mono text-label">{where}</span>}
                  <span>
                    {new Date(session.lastActiveAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
            {!isCurrent && (
              <DotMenu
                label="Device options"
                items={[
                  {
                    key: "revoke",
                    label: "Sign out of device",
                    danger: true,
                    onSelect: () =>
                      setConfirm({
                        title: "Sign out of this device?",
                        description: "The device will be signed out the next time it talks to the server.",
                        label: "Sign out device",
                        run: async () => {
                          await session.revoke();
                          setSessions((list) => list?.filter((s) => s.id !== session.id) ?? null);
                          toast.success("Device signed out.");
                        },
                      }),
                  },
                ]}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
