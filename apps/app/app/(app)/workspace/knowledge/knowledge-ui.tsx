"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KbDocStatus, KbSourceType } from "@alevo/db";
import { Button, buttonClass, Spinner } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { cx } from "@/lib/cx";
import { KB_STATUS } from "@/lib/ui/status";
import { toast, useActionToast } from "@/lib/ui/use-action-toast";
import { addDocument, addPdfDocument, deleteDocument, reingestDocument, type ActionState } from "./actions";

const INITIAL: ActionState = {};

type Tab = Extract<KbSourceType, "text" | "url" | "pdf">;
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "text", label: "Paste text" },
  { id: "url", label: "Web address" },
  { id: "pdf", label: "PDF" },
];

const SOURCE_LABEL: Record<KbSourceType, string> = { text: "Text", url: "Web address", pdf: "PDF" };

export function AddDocumentForm() {
  const [tab, setTab] = useState<Tab>("text");
  const [state, action, pending] = useActionState(addDocument, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  useActionToast(state, "Added to the knowledge base. Indexing starts now.");

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const e = state.errors;

  return (
    <Card>
      <CardHeader
        title="Add to the knowledge base"
        hint="Services, pricing, FAQs and policies. The agent reads these before every reply instead of guessing."
      />

      <div role="tablist" aria-label="Source type" className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              "h-8 rounded-full border px-3 text-label font-medium transition-colors",
              tab === t.id ? "border-brand bg-brand-soft text-ink" : "border-hairline text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "pdf" ? (
          <PdfUpload />
        ) : (
          <form ref={formRef} action={action} noValidate className="space-y-4">
            <input type="hidden" name="sourceType" value={tab} />
            <Field label="Title" htmlFor="kb-title" error={e?.title}>
              <Input
                id="kb-title"
                name="title"
                defaultValue={state.values?.title ?? ""}
                placeholder="Services and pricing"
                invalid={!!e?.title}
              />
            </Field>

            {tab === "text" ? (
              <Field label="Text" htmlFor="kb-text" error={e?.text}>
                <Textarea
                  id="kb-text"
                  name="text"
                  rows={5}
                  defaultValue={state.values?.text ?? ""}
                  placeholder="Paste FAQs, service descriptions, policies…"
                  invalid={!!e?.text}
                />
              </Field>
            ) : (
              <Field label="Web address" htmlFor="kb-url" hint="One page. The agent reads its text content." error={e?.url}>
                <Input
                  id="kb-url"
                  name="url"
                  defaultValue={state.values?.url ?? ""}
                  placeholder="https://your-site.com/services"
                  invalid={!!e?.url}
                />
              </Field>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              {state.error && <p className="text-sm text-danger">{state.error}</p>}
              <Button type="submit" variant="primary" loading={pending}>
                {pending ? "Adding…" : "Add to knowledge base"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

/** PDF: presign → PUT to R2 → register the doc (reuses the files presign route). */
function PdfUpload() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setFailed(false);
    try {
      setStatus("Requesting upload URL…");
      const presignRes = await fetch("/api/files/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/pdf",
          sizeBytes: file.size,
          purpose: "knowledge",
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

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-control p-8 text-center">
      <p className="text-sm text-ink-muted">A PDF up to the plan limit. Text is extracted and indexed.</p>
      <label
        htmlFor="kb-pdf"
        aria-disabled={busy || undefined}
        className={buttonClass("primary", "md", busy ? "pointer-events-none opacity-50" : "cursor-pointer")}
      >
        {busy && <Spinner />}
        {busy ? "Working…" : "Choose a PDF"}
      </label>
      <input
        id="kb-pdf"
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        className="sr-only"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          if (f) void handleFile(f);
          ev.target.value = "";
        }}
      />
      {status && (
        <p role="status" className={failed ? "text-sm text-danger" : "text-sm text-ink-muted"}>
          {status}
        </p>
      )}
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
  /** Formatted for display (org timezone). */
  added: string;
  /** PDF size, formatted; null for text/url sources. */
  size: string | null;
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

  return (
    <Card padding="none" className="px-6">
      <div className="flex items-center justify-between py-5">
        <h2 className="text-heading font-semibold">Knowledge base</h2>
        <span className="text-label text-ink-muted">
          {docs.length} {docs.length === 1 ? "document" : "documents"}
        </span>
      </div>
      {docs.length === 0 ? (
        <p className="pb-6 text-sm text-ink-muted">No sources yet. Add text, a web address or a PDF above.</p>
      ) : (
        <ul>
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function DocumentRow({ doc }: { doc: DocView }) {
  const [reState, reAction, rePending] = useActionState(reingestDocument, INITIAL);
  const [delState, delAction, delPending] = useActionState(deleteDocument, INITIAL);
  useActionToast(reState, "Re-indexing started.");
  useActionToast(delState, "Document deleted.");
  const status = KB_STATUS[doc.status];

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-hairline py-4 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{doc.title}</p>
        <p className="truncate text-label text-ink-muted">
          {SOURCE_LABEL[doc.sourceType]}
          {doc.size && `, ${doc.size}`}
          {`, added ${doc.added}`}
          {doc.status === "ready" && `, ${doc.chunkCount} ${doc.chunkCount === 1 ? "chunk" : "chunks"}`}
          {doc.status === "failed" && doc.error && <span className="text-danger">, {doc.error}</span>}
        </p>
      </div>
      <div className="order-last col-span-2 sm:order-none sm:col-span-1">
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        {doc.status !== "processing" && (
          <form action={reAction}>
            <input type="hidden" name="id" value={doc.id} />
            <Button type="submit" size="sm" variant="ghost" loading={rePending}>
              Re-index
            </Button>
          </form>
        )}
        <form action={delAction}>
          <input type="hidden" name="id" value={doc.id} />
          <ConfirmSubmit
            size="sm"
            loading={delPending}
            title={`Delete "${doc.title}"?`}
            description="The agent stops using it immediately, and the file and its indexed text are deleted. This can't be undone."
            confirmLabel="Delete document"
          >
            Delete
          </ConfirmSubmit>
        </form>
      </div>
    </li>
  );
}
