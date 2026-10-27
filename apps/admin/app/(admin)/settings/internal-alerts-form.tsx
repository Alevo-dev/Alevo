"use client";

import { useActionState, useState } from "react";
import { Button } from "@alevo/ui/button";
import { ConfirmSubmit } from "@alevo/ui/confirm-dialog";
import { FieldError, Input } from "@alevo/ui/field";
import { Notice } from "@alevo/ui/notice";
import { Pill } from "@alevo/ui/pill";
import { clearInternalWebhook, saveInternalWebhook, sendTestInternal, type SettingsState } from "./actions";

const INITIAL: SettingsState = {};

/**
 * The internal alerts webhook, one place: Set / Not set, a field to save a new
 * value (blank keeps the stored one), Send test, and Clear behind a confirm.
 * The saved value is never shown again (rule 12). Rule 13: errors inline.
 */
export function InternalAlertsForm({ isSet, savedAt }: { isSet: boolean; savedAt: string | null }) {
  const [value, setValue] = useState("");
  const [save, saveAction, saving] = useActionState(
    async (prev: SettingsState, formData: FormData) => {
      const next = await saveInternalWebhook(prev, formData);
      if (next.ok) setValue("");
      return next;
    },
    INITIAL,
  );
  const [test, testAction, testing] = useActionState(sendTestInternal, INITIAL);
  const [clear, clearAction, clearing] = useActionState(clearInternalWebhook, INITIAL);
  const dirty = value.trim() !== "";

  return (
    <div className="space-y-6">
      <form action={saveAction} noValidate className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label htmlFor="webhook" className="text-sm font-semibold text-ink">
              Slack incoming webhook
            </label>
            <p className="mt-1 text-label text-ink-muted">
              From your Slack workspace: Apps → Incoming Webhooks → Add to the alerts channel. The daily speed-to-lead watch posts here.
              {savedAt && ` Last saved ${savedAt}.`}
            </p>
          </div>
          <Pill tone={isSet ? "success" : "muted"}>{isSet ? "Set" : "Not set"}</Pill>
        </div>
        <Input
          id="webhook"
          name="webhook"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          invalid={!!save.errors?.webhook}
          placeholder={isSet ? "Paste a new URL to replace the saved one" : "https://hooks.slack.com/services/…"}
          className="font-mono text-label"
        />
        <FieldError>{save.errors?.webhook}</FieldError>
        {save.error && <Notice tone="danger">{save.error}</Notice>}
        {save.ok && !dirty && <Notice tone="success">Saved. The watch uses this webhook from its next run.</Notice>}
        {dirty && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setValue("")}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        )}
      </form>

      {isSet && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
          <p className="text-sm text-ink-muted">Post a test line to the channel, or remove the webhook.</p>
          <div className="flex items-center gap-2">
            <form action={testAction}>
              <Button type="submit" size="sm" variant="ghost" loading={testing}>
                Send test
              </Button>
            </form>
            <form action={clearAction}>
              <ConfirmSubmit
                size="sm"
                loading={clearing}
                title="Clear the internal alerts webhook?"
                description="The speed-to-lead watch stops posting until a new one is saved."
                confirmLabel="Clear webhook"
              >
                Clear
              </ConfirmSubmit>
            </form>
          </div>
          {test.ok && <Notice tone="success" className="w-full">Test sent. Check the channel.</Notice>}
          {test.error && <Notice tone="danger" className="w-full">{test.error}</Notice>}
          {clear.error && <Notice tone="danger" className="w-full">{clear.error}</Notice>}
        </div>
      )}
    </div>
  );
}
