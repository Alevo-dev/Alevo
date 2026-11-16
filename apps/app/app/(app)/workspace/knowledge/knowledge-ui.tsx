"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KbDocStatus, KbSourceType } from "@alevo/db";
import { AlignLeft, Check, Clock, FileText, Info, Link2, Loader2, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldError, Input, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Pill } from "@/components/ui/pill";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/ui/table";
import type { Tone } from "@/lib/ui/status";
import { toast, useActionToast } from "@/lib/ui/use-action-toast";
import { addDocument, addPdfDocument, deleteDocument, reingestDocument, type ActionState } from "./actions";

const INITIAL: ActionState = {};

type Kind = Extract<KbSourceType, "text" | "url">;

const SOURCE: Record<KbSourceType, { label: string; Icon: typeof FileText }> = {
  text: { label: "Text", Icon: AlignLeft },
  url: { label: "URL", Icon: Link2 },
  pdf: { label: "PDF", Icon: FileText },
};

/** Status as the Knowledge board words it, with the icon in its tinted circle. */
const STATUS: Record<KbDocStatus, { label: string; tone: Tone; Icon: typeof Check }> = {
  pending: { label: "Queued", tone: "muted", Icon: Clock },
  processing: { label: "Indexing", tone: "brand", Icon: Loader2 },
  ready: { label: "Ready", tone: "success", Icon: Check },
  failed: { label: "Failed", tone: "danger", Icon: X },
};
const CIRCLE: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  brand: "bg-brand/15 text-brand-ink",
  danger: "bg-danger/15 text-danger",
  muted: "bg-raised text-ink-muted",
  violet: "bg-violet/15 text-violet-ink",
  warning: "bg-warning/15 text-warning",
};

export type DocView = {
  id: string;
  title: string;
  sourceType: KbSourceType;
  status: KbDocStatus;
  chunkCount: number;
  error: string | null;
  /** Formatted for display (org timezone). */
  added: string;
  /** PDF size, formatted; null for text/url sources. */
  size: string | null;
};

/** Add text / Add URL: a dialog with its own form, closed once the document is queued. */
function AddDialog({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const [state, action, pending] = useActionState(addDocument, INITIAL);
  useActionToast(state, "Added to the knowledge base. Indexing starts now.");
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);
  const e = state.errors;

  return (
    <Dialog
      open
      title={kind === "text" ? "Add text" : "Add URL"}
      description="Services, pricing, FAQs and policies. The agent reads these before every reply instead of guessing."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="kb-add" variant="primary" loading={pending}>
            {pending ? "Adding…" : "Add to knowledge base"}
          </Button>
        </>
      }
    >
      <form id="kb-add" action={action} noValidate className="space-y-4">
        <input type="hidden" name="sourceType" value={kind} />
        <Field label="Title" htmlFor="kb-title" error={e?.title}>
          <Input id="kb-title" name="title" defaultValue={state.values?.title ?? ""} placeholder="Services and pricing" invalid={!!e?.title} />
        </Field>
        {kind === "text" ? (
          <Field label="Text" htmlFor="kb-text" error={e?.text}>
            <Textarea id="kb-text" name="text" rows={6} defaultValue={state.values?.text ?? ""} placeholder="Paste FAQs, service descriptions, policies…" invalid={!!e?.text} />
          </Field>
        ) : (
          <Field label="Web address" htmlFor="kb-url" hint="One page. The agent reads its text content." error={e?.url}>
            <Input id="kb-url" name="url" defaultValue={state.values?.url ?? ""} placeholder="https://your-site.com/services" invalid={!!e?.url} />
          </Field>
        )}
        <FieldError>{state.error}</FieldError>
      </form>
    </Dialog>
  );
}

/** Upload PDF: presign → PUT to R2 → register the doc (reuses the files presign route). */
function usePdfUpload() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setFailed(false);
    try {
      setStatus("Requesting upload URL…");
      const presignRes = await fetch("/api/files/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/pdf", sizeBytes: file.size, purpose: "knowledge" }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok) throw new Error(presign.error ?? "Presign failed");

      setStatus("Uploading…");
      const putRes = await fetch(presign.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/pdf" }, body: file });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      setStatus("Indexing…");
      const res = await addPdfDocument({ title: file.name, r2Key: presign.key });
      if (!res.ok) throw new Error(res.error ?? "Could not add the PDF");
      setStatus("");
      toast.success(`Added ${file.name}. Indexing starts now.`);
      router.refresh();
    } catch (err) {
      setFailed(true);
      setStatus(err instanceof Error ? err.message : "Upload error");
    } finally {
      setBusy(false);
    }
  }
  return { status, failed, busy, upload };
}

export function KnowledgeView({ docs, model }: { docs: DocView[]; model: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState<Kind | null>(null);
  const [query, setQuery] = useState("");
  const pdf = usePdfUpload();
  const fileRef = useRef<HTMLInputElement>(null);
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

  const q = query.trim().toLowerCase();
  const shown = q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs;
  const passages = docs.reduce((n, d) => n + (d.status === "ready" ? d.chunkCount : 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="primary" onClick={() => setAdding("text")}>
          <Plus className="size-3.5" aria-hidden="true" />
          Add text
        </Button>
        <Button onClick={() => setAdding("url")}>
          <Link2 className="size-3.5" aria-hidden="true" />
          Add URL
        </Button>
        <Button loading={pdf.busy} onClick={() => fileRef.current?.click()}>
          {!pdf.busy && <Upload className="size-3.5" aria-hidden="true" />}
          Upload PDF
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a PDF"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) void pdf.upload(f);
            ev.target.value = "";
          }}
        />
        <span className="flex-1" />
        <label className="relative">
          <span className="sr-only">Filter documents</span>
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <Input inline className="min-w-60 pl-7" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Filter documents" />
        </label>
      </div>
      {pdf.status && (
        <p role="status" className={pdf.failed ? "text-label text-danger" : "text-label text-ink-muted"}>
          {pdf.status}
        </p>
      )}

      <div className="flex items-start gap-2.5 rounded-sm border border-brand/60 bg-brand/[0.07] px-3 py-[9px] text-[13.5px] text-brand-ink">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <div>The agent reads the closest passages to each lead message. Deleting a document removes its file, its index and its passages.</div>
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-heading font-medium text-ink">Documents</h2>
          <span className="text-label text-ink-muted">{`${docs.length} ${docs.length === 1 ? "document" : "documents"}, ${passages} passages`}</span>
        </div>
        <Table>
          <thead>
            <tr>
              <Th className="w-9">
                <span className="sr-only">Status</span>
              </Th>
              <Th>Document</Th>
              <Th>Source</Th>
              <Th>Status</Th>
              <Th className="text-right">Chunks</Th>
              <Th>Added</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <EmptyRow colSpan={7}>{docs.length === 0 ? "No sources yet. Add text, a URL or a PDF above." : "No documents match."}</EmptyRow>
            ) : (
              shown.map((d) => <DocumentRow key={d.id} doc={d} />)
            )}
          </tbody>
        </Table>
        <p className="text-label text-ink-muted">Search model: {model}, 1024 dimensions</p>
      </section>

      {adding && <AddDialog kind={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function DocumentRow({ doc }: { doc: DocView }) {
  const [reState, reAction, rePending] = useActionState(reingestDocument, INITIAL);
  const [delState, delAction, delPending] = useActionState(deleteDocument, INITIAL);
  useActionToast(reState, "Re-indexing started.");
  useActionToast(delState, "Document deleted.");
  const s = STATUS[doc.status];
  const src = SOURCE[doc.sourceType];

  return (
    <Tr>
      <Td>
        <span className={`inline-flex size-[18px] items-center justify-center rounded-full ${CIRCLE[s.tone]}`}>
          <s.Icon className={doc.status === "processing" ? "size-3 animate-spin motion-reduce:animate-none" : "size-3"} strokeWidth={2} aria-hidden="true" />
        </span>
      </Td>
      <Td className="max-w-[360px] whitespace-normal">
        <span className="font-semibold text-ink">{doc.title}</span>
        {doc.size && <span className="block text-label font-normal text-ink-muted">{doc.size}</span>}
        {doc.status === "failed" && doc.error && <span className="block text-label font-normal text-danger">{doc.error}</span>}
      </Td>
      <Td className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <src.Icon className="size-3.5 text-ink-muted" strokeWidth={1.75} aria-hidden="true" />
          {src.label}
        </span>
      </Td>
      <Td>
        <Pill tone={s.tone}>{s.label}</Pill>
      </Td>
      <Td className="text-right font-mono tabular-nums">{doc.status === "ready" ? doc.chunkCount : "—"}</Td>
      <Td className="whitespace-nowrap font-mono text-ink-muted">{doc.added}</Td>
      <Td className="text-right">
        <span className="inline-flex gap-1.5">
          {doc.status !== "processing" && (
            <form action={reAction}>
              <input type="hidden" name="id" value={doc.id} />
              <IconButton type="submit" loading={rePending} aria-label={doc.status === "failed" ? `Retry ${doc.title}` : `Re-index ${doc.title}`} title={doc.status === "failed" ? "Retry" : "Re-index"}>
                <RefreshCw className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </form>
          )}
          <form action={delAction}>
            <input type="hidden" name="id" value={doc.id} />
            <ConfirmSubmit
              icon={Trash2}
              aria-label={`Delete ${doc.title}`}
              loading={delPending}
              title={`Delete "${doc.title}"?`}
              description="The agent stops using it immediately, and the file and its indexed text are deleted. This can't be undone."
              confirmLabel="Delete document"
            />
          </form>
        </span>
      </Td>
    </Tr>
  );
}
