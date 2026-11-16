"use client";

import { useActionState, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { ImagePlus, LifeBuoy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldError, Input, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { MAX_SCREENSHOTS } from "@/lib/support/report";
import { useActionToast } from "@/lib/ui/use-action-toast";
import { sendSupportReport, type SupportState } from "./actions";

const INITIAL: SupportState = {};

/** Shrink a screenshot before upload: longest side 1600px, JPEG. Keeps a retina screenshot well under the limit. */
async function compress(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff"; // a transparent PNG would turn black as a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("no blob");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** The top bar's Support icon: a dialog to report a problem (what, how it happened, screenshots). It goes to Alevo, not to the workspace's Slack. */
export function SupportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton aria-label="Support: report a problem" title="Support" onClick={() => setOpen(true)}>
        <LifeBuoy className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
      {open && <SupportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SupportDialog({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(sendSupportReport, INITIAL);
  useActionToast(state, "Thanks, we have your report.", { refresh: false });
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [shotError, setShotError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const e = state.errors;

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);
  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.url)), [shots]);

  async function add(list: File[]) {
    setShotError("");
    const images = list.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const room = MAX_SCREENSHOTS - shots.length;
    if (room <= 0) return setShotError(`Attach up to ${MAX_SCREENSHOTS} screenshots.`);
    try {
      const made = await Promise.all(images.slice(0, room).map(compress));
      setShots((s) => [...s, ...made.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      if (images.length > room) setShotError(`Only ${MAX_SCREENSHOTS} screenshots fit; the rest were left out.`);
    } catch {
      setShotError("We could not read that image. Try a PNG or JPEG.");
    }
  }

  const submit = (fd: FormData) => {
    fd.delete("screenshots");
    shots.forEach((s) => fd.append("screenshots", s.file));
    fd.set("page", location.origin + location.pathname);
    fd.set("browser", navigator.userAgent);
    fd.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    return action(fd);
  };

  const onPaste = (ev: ClipboardEvent) => {
    const files = [...ev.clipboardData.items].flatMap((i) => (i.kind === "file" && i.type.startsWith("image/") ? [i.getAsFile()!] : []));
    if (files.length > 0) {
      ev.preventDefault();
      void add(files);
    }
  };

  return (
    <Dialog
      open
      title="Report a problem"
      description="Tell us what went wrong. This goes to the Alevo team, not to your workspace's Slack."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="support-form" variant="primary" loading={pending}>
            {pending ? "Sending…" : "Send report"}
          </Button>
        </>
      }
    >
      <form id="support-form" action={submit} noValidate onPaste={onPaste} className="space-y-4">
        <Field label="What is the problem?" htmlFor="support-title" error={e?.title}>
          <Input id="support-title" name="title" defaultValue={state.values?.title ?? ""} placeholder="The Reschedule button does nothing" invalid={!!e?.title} maxLength={140} />
        </Field>
        <Field label="What happened?" htmlFor="support-what" hint="What you saw, and what you expected instead." error={e?.what}>
          <Textarea id="support-what" name="what" rows={4} defaultValue={state.values?.what ?? ""} invalid={!!e?.what} />
        </Field>
        <Field label="How did it happen?" htmlFor="support-steps" hint="Optional. The steps, in order, so we can repeat it." error={e?.steps}>
          <Textarea id="support-steps" name="steps" rows={3} defaultValue={state.values?.steps ?? ""} placeholder={"1. Open Meetings\n2. Click Reschedule on any row"} invalid={!!e?.steps} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <div>
            <span className="text-sm font-medium text-ink">Screenshots</span>
            <p className="mt-0.5 text-label text-ink-muted">Optional. Up to {MAX_SCREENSHOTS}. Choose files, or paste an image with Ctrl+V.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {shots.map((s, i) => (
              <div key={s.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a remote image */}
                <img src={s.url} alt={`Screenshot ${i + 1}`} className="h-16 w-24 rounded-xs border border-hairline object-cover" />
                <IconButton
                  aria-label={`Remove screenshot ${i + 1}`}
                  onClick={() => setShots((all) => all.filter((_, j) => j !== i))}
                  className="absolute -right-2 -top-2 size-5 rounded-full border border-control bg-surface"
                >
                  <X className="size-3" strokeWidth={2} />
                </IconButton>
              </div>
            ))}
            {shots.length < MAX_SCREENSHOTS && (
              <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
                <ImagePlus className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
                Add screenshot
              </Button>
            )}
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(ev) => {
                void add([...(ev.target.files ?? [])]);
                ev.target.value = "";
              }}
            />
          </div>
          <FieldError>{shotError || e?.screenshots}</FieldError>
        </div>

        <p className="text-label text-ink-muted">We also send your name, workspace, the page you are on and your browser, so we can find the problem faster.</p>
        <FieldError>{state.error}</FieldError>
      </form>
    </Dialog>
  );
}
