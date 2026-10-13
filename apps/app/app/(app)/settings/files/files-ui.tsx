"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

/**
 * Uploads directly to R2: ask our API for a presigned PUT URL, PUT the file to
 * R2, then confirm. The object never passes through our server.
 */
export function FileUpload() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("Requesting upload URL…");
    const contentType = file.type || "application/octet-stream";
    try {
      const presignRes = await fetch("/api/files/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType, sizeBytes: file.size }),
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
      setStatus(`Uploaded ${file.name}.`);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload error");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <label className="text-sm font-medium">Upload a file</label>
      <input
        type="file"
        onChange={handleChange}
        disabled={busy}
        className="mt-2 block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1 file:text-sm"
      />
      {status && <p className="mt-2 text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
