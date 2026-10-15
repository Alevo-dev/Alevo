"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KbDocStatus, KbSourceType } from "@alevo/db";
import {
  addDocument,
  addPdfDocument,
  deleteDocument,
  reingestDocument,
  type ActionState,
} from "./actions";

const INITIAL: ActionState = {};

const fieldClass = (err: boolean) =>
  `w-full rounded-md border bg-background px-3 py-2 text-sm ${err ? "border-destructive" : "border-input"}`;
const errMsg = "mt-1 text-xs text-destructive";
const btn = "rounded-md border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-50";

type Tab = Extract<KbSourceType, "text" | "url" | "pdf">;

export function AddDocumentForm() {
  const [tab, setTab] = useState<Tab>("text");
  const [state, action, pending] = useActionState(addDocument, INITIAL);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const e = state.errors;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex gap-1">
        {(["text", "url", "pdf"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 text-sm ${
              tab === t ? "bg-foreground text-background" : "border border-border hover:bg-accent"
            }`}
          >
            {t === "text" ? "Paste text" : t === "url" ? "URL" : "PDF"}
          </button>
        ))}
      </div>

      {tab === "pdf" ? (
        <PdfUpload />
      ) : (
        <form ref={formRef} action={action} noValidate className="space-y-3">
          <input type="hidden" name="sourceType" value={tab} />
          <div>
            <input
              name="title"
              defaultValue={state.values?.title ?? ""}
              placeholder="Title (e.g. Services & pricing)"
              aria-invalid={!!e?.title}
              className={fieldClass(!!e?.title)}
            />
            {e?.title && <p className={errMsg}>{e.title}</p>}
          </div>

          {tab === "text" ? (
            <div>
              <textarea
                name="text"
                rows={5}
                defaultValue={state.values?.text ?? ""}
                placeholder="Paste FAQs, service descriptions, policies…"
                aria-invalid={!!e?.text}
                className={fieldClass(!!e?.text)}
              />
              {e?.text && <p className={errMsg}>{e.text}</p>}
            </div>
          ) : (
            <div>
              <input
                name="url"
                defaultValue={state.values?.url ?? ""}
                placeholder="https://your-site.com/services"
                aria-invalid={!!e?.url}
                className={fieldClass(!!e?.url)}
              />
              {e?.url && <p className={errMsg}>{e.url}</p>}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className={btn}>
              {pending ? "Adding…" : "Add to knowledge base"}
            </button>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}

/** PDF: presign → PUT to R2 → register the doc (reuses the files presign route). */
function PdfUpload() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      setStatus("Requesting upload URL…");
      const presignRes = await fetch("/api/files/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/pdf",
          sizeBytes: file.size,
        }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error ?? "Presign failed");

      setStatus("Uploading…");
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/pdf" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      setStatus("Processing…");
      const res = await addPdfDocument({ title: file.name, r2Key: presign.key });
      if (!res.ok) throw new Error(res.error ?? "Could not add the PDF");
      setStatus(`Added ${file.name}.`);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f) void handleFile(f);
          ev.target.value = "";
        }}
        className="block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1 file:text-sm"
      />
      {status && <p className="mt-2 text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}

export type DocView = {
  id: string;
  title: string;
  sourceType: KbSourceType;
  status: KbDocStatus;
  chunkCount: number;
  error: string | null;
};

const STATUS_STYLE: Record<KbDocStatus, string> = {
  pending: "text-muted-foreground",
  processing: "text-muted-foreground",
  ready: "text-accent-foreground",
  failed: "text-destructive",
};

export function DocumentList({ docs }: { docs: DocView[] }) {
  const router = useRouter();
  const hasPending = docs.some((d) => d.status === "pending" || d.status === "processing");

  // Ingestion is async; poll briefly while any doc is still processing.
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => router.refresh(), 3000);
    const stop = setTimeout(() => clearInterval(id), 60000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [hasPending, router]);

  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No sources yet. Add text, a URL, or a PDF above.</p>;
  }

  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <DocumentRow key={d.id} doc={d} />
      ))}
    </div>
  );
}

function DocumentRow({ doc }: { doc: DocView }) {
  const [, reAction, rePending] = useActionState(reingestDocument, INITIAL);
  const [, delAction, delPending] = useActionState(deleteDocument, INITIAL);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{doc.title}</p>
        <p className="text-xs text-muted-foreground">
          {doc.sourceType} · <span className={STATUS_STYLE[doc.status]}>{doc.status}</span>
          {doc.status === "ready" && ` · ${doc.chunkCount} chunks`}
          {doc.status === "failed" && doc.error && ` · ${doc.error}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {(doc.status === "failed" || doc.status === "ready") && (
          <form action={reAction}>
            <input type="hidden" name="id" value={doc.id} />
            <button type="submit" disabled={rePending} className={btn}>
              {rePending ? "…" : "Re-ingest"}
            </button>
          </form>
        )}
        <form action={delAction}>
          <input type="hidden" name="id" value={doc.id} />
          <button type="submit" disabled={delPending} className={btn}>
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
