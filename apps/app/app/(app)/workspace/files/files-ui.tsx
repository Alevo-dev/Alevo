"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { buttonClass, Spinner } from "@/components/ui/button";

/**
 * Uploads directly to R2: ask our API for a presigned PUT URL, PUT the file to
 * R2, then confirm. The object never passes through our server.
 */
export function FileUpload() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFailed(false);
    setStatus("Requesting upload URL…");
    const contentType = file.type || "application/octet-stream";
    try {
      const presignRes = await fetch("/api/files/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType, sizeBytes: file.size, purpose: "file" }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error ?? "Presign failed");

      setStatus("Uploading…");
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "content-type": contentType },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      await fetch("/api/files/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: presign.fileId }),
      });
      setStatus("");
      toast.success(`Uploaded ${file.name}.`);
      router.refresh();
    } catch (err) {
      setFailed(true);
      setStatus(err instanceof Error ? err.message : "Upload error");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <section
      aria-label="Upload a file"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-control p-8 text-center transition-colors hover:border-brand"
    >
      <div className="text-base font-semibold text-ink">Upload a file</div>
      <p className="text-sm text-ink-muted">Stored in your private bucket. Any type, up to the plan limit.</p>
      <label
        htmlFor="file-upload"
        aria-disabled={busy || undefined}
        className={buttonClass("primary", "md", busy ? "mt-2 pointer-events-none opacity-50" : "mt-2 cursor-pointer")}
      >
        {busy && <Spinner />}
        {busy ? "Working…" : "Choose a file"}
      </label>
      <input id="file-upload" type="file" onChange={handleChange} disabled={busy} className="sr-only" />
      {status && (
        <p role="status" className={failed ? "text-sm text-danger" : "text-sm text-ink-muted"}>
          {status}
        </p>
      )}
    </section>
  );
}
