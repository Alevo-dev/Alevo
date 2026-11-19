"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@alevo/ui/skeleton";
import { Pill } from "@/components/ui/pill";
import { MAX_CHUNK_CHARS } from "@/lib/kb/chunk-edit";
import { toast } from "@/lib/ui/use-action-toast";
import { deleteChunk, loadChunks, saveChunk, type ChunkPage, type ChunkView } from "./actions";

/** A document's passages, in order: read them, fix the text the agent will quote, or remove one. */
export function ChunksDialog({ documentId, title, onClose }: { documentId: string; title: string; onClose: () => void }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ChunkPage | null>(null);
  /** Kept across page turns so the footer (Previous / Next) stays put while the placeholders show. */
  const [pages, setPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  const load = useCallback(
    (p: number) =>
      startLoad(async () => {
        const res = await loadChunks(documentId, p);
        if ("error" in res) setError(res.error);
        else {
          setError(null);
          setData(res);
          setPage(res.page);
          setPages(res.pages);
        }
      }),
    [documentId],
  );
  useEffect(() => load(1), [load]);
  /** Turning a page shows the placeholders again, so the window never jumps between content and "nothing". */
  const go = (p: number) => {
    setData(null);
    load(p);
  };

  return (
    <Dialog
      open
      size="xl"
      title={title}
      description="The passages the agent reads, in order. Fix what the extraction got wrong; a saved change is used by the agent straight away."
      onClose={onClose}
      footer={
        <>
          {pages > 1 && (
            <span className="mr-auto flex items-center gap-2 text-label text-ink-muted">
              <Button size="sm" disabled={loading || page <= 1} onClick={() => go(page - 1)}>
                Previous
              </Button>
              {`Page ${page} of ${pages}`}
              <Button size="sm" disabled={loading || page >= pages} onClick={() => go(page + 1)}>
                Next
              </Button>
            </span>
          )}
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-label text-ink-muted">
          Neighbouring passages overlap by a couple of sentences, so a fix may need making in both. Re-indexing the document replaces every passage, edited ones included.
        </p>
        <FieldError>{error}</FieldError>
        <div className="h-[58vh] overflow-y-auto pr-1" aria-busy={!data && !error}>
          {!data && !error && <ChunksSkeleton />}
          {data?.total === 0 && <p className="text-label text-ink-muted">This document has no passages yet.</p>}
          <ol className="space-y-2.5">
            {data?.chunks.map((c) => (
            <ChunkItem
              key={c.id}
              chunk={c}
              onChanged={() => {
                load(page);
                router.refresh();
              }}
            />
            ))}
          </ol>
        </div>
      </div>
    </Dialog>
  );
}

/** Placeholder cards shaped like the passages (number, a few lines of text, the two icons), so nothing shifts when they arrive. */
function ChunksSkeleton() {
  const lines = ["w-full", "w-[94%]", "w-[88%]", "w-full", "w-[62%]"];
  return (
    <ol className="space-y-2.5" role="status" aria-label="Loading passages">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-sm border border-hairline bg-surface p-3">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-3.5 w-7 rounded-xs" delay={i * 90} />
            <span className="flex-1" />
            <Skeleton className="size-5 rounded-xs" delay={i * 90 + 40} />
            <Skeleton className="size-5 rounded-xs" delay={i * 90 + 80} />
          </div>
          <div className="space-y-2">
            {lines.map((w, j) => (
              <Skeleton key={j} className={`h-3.5 ${w} rounded-xs`} delay={i * 90 + j * 50} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ChunkItem({ chunk, onChanged }: { chunk: ChunkView; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(chunk.content);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveChunk(chunk.id, text);
      if (res.error) return setError(res.error);
      setError(null);
      setEditing(false);
      toast.success("Passage saved.");
      onChanged();
    });
  }
  function remove() {
    start(async () => {
      const res = await deleteChunk(chunk.id);
      setConfirming(false);
      if (res.error) return setError(res.error);
      toast.success("Passage deleted.");
      onChanged();
    });
  }

  return (
    <li className="rounded-sm border border-hairline bg-surface p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-label text-ink-muted">{`#${chunk.index + 1}`}</span>
        {chunk.edited && <Pill tone="violet">Edited</Pill>}
        <span className="flex-1" />
        {!editing && (
          <>
            <IconButton aria-label={`Edit passage ${chunk.index + 1}`} title="Edit" onClick={() => { setText(chunk.content); setEditing(true); }}>
              <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
            <IconButton aria-label={`Delete passage ${chunk.index + 1}`} title="Delete" onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} invalid={!!error} aria-label={`Text of passage ${chunk.index + 1}`} />
          <FieldError>{error}</FieldError>
          <div className="flex items-center gap-2">
            <span className={`mr-auto text-label ${text.length > MAX_CHUNK_CHARS ? "text-danger" : "text-ink-muted"}`}>{`${text.length} / ${MAX_CHUNK_CHARS}`}</span>
            <Button size="sm" disabled={pending} onClick={() => { setEditing(false); setError(null); }}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={pending} onClick={save}>
              Save passage
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-[13.5px] text-ink">{chunk.content}</p>
          {error && <FieldError>{error}</FieldError>}
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Delete passage ${chunk.index + 1}?`}
        description="The agent stops using this text. Re-indexing the document would bring it back."
        confirmLabel="Delete passage"
        busy={pending}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </li>
  );
}
