"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/field";
import { importMessage } from "@/lib/profile/import-error";
import type { ImportedProfile, ImportMode } from "@/lib/profile/merge";
import { importFromWebsite } from "./actions";

const MODES: { value: ImportMode; label: string; hint: string }[] = [
  { value: "fill", label: "Fill empty fields only", hint: "Keeps everything you have already written." },
  { value: "replace", label: "Replace existing values", hint: "Overwrites a field when the site has an answer for it." },
];

export function ImportDialog({
  open,
  hasContent,
  onClose,
  onImported,
}: {
  open: boolean;
  /** Some profile field already has text, so ask how to treat it. */
  hasContent: boolean;
  onClose: () => void;
  onImported: (imported: ImportedProfile, mode: ImportMode) => void;
}) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<ImportMode>("fill");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setError(null);
    onClose();
  };

  function submit() {
    if (pending) return;
    if (!url.trim()) return setError("Enter your website address.");
    setError(null);
    start(async () => {
      // A dropped connection or a timed-out action rejects; show it here instead of
      // letting it reach the error boundary and throw away the admin's unsaved edits.
      let res: Awaited<ReturnType<typeof importFromWebsite>>;
      try {
        res = await importFromWebsite(url);
      } catch {
        return setError(importMessage("extract_failed"));
      }
      if (!res.ok) return setError(res.error);
      onImported(res.imported, hasContent ? mode : "fill");
      setUrl("");
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      title="Import from your website"
      description="We read your site and fill in the profile. Nothing is saved until you review it and press Save."
      onClose={pending ? () => {} : close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending}>
            {pending ? "Reading your site…" : "Import"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="import-url">Website address</Label>
          <Input
            id="import-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="yourcompany.com"
            value={url}
            disabled={pending}
            invalid={!!error}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div aria-live="polite">
            <FieldError>{error}</FieldError>
          </div>
        </div>

        {hasContent && (
          <fieldset disabled={pending} className="space-y-2">
            <legend className="text-sm font-medium text-ink">Some fields already have text</legend>
            {MODES.map((m) => (
              <label key={m.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md bg-raised p-3 text-sm">
                <input
                  type="radio"
                  name="import-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="mt-0.5 size-4 shrink-0 accent-brand"
                />
                <span>
                  <span className="block font-medium text-ink">{m.label}</span>
                  <span className="block text-ink-muted">{m.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}
