"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { files, kbChunks, kbDocuments, recordAudit, withService, safeErrorMessage } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { EMBEDDING_MODEL, embedDocuments } from "@/lib/kb/embeddings";
import { CHUNKS_PER_PAGE, cleanChunk } from "@/lib/kb/chunk-edit";
import * as Sentry from "@sentry/nextjs";
import { inngest } from "@/lib/inngest/client";
import { deleteObject } from "@/lib/r2";
import type { KbSourceType } from "@alevo/db";

export type AddValues = { sourceType: KbSourceType; title: string; text: string; url: string };
export type AddErrors = { title?: string; text?: string; url?: string };
export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: AddErrors;
  values?: AddValues;
};

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function orgId(): Promise<string> {
  const org = await getCurrentOrg();
  if (!org) throw new Error("No active organization");
  return org.id;
}

/**
 * Queue ingestion. If the event can't be sent (no/invalid INNGEST_EVENT_KEY,
 * Inngest unreachable), say so on the document instead of leaving it "Queued"
 * forever: it flips to failed with the reason, and Re-index retries.
 */
async function fireIngest(org: string, documentId: string) {
  try {
    await inngest.send({ name: "kb/document.ingest", data: { orgId: org, documentId } });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    Sentry.captureException(err);
    await withOrg((tx) =>
      tx
        .update(kbDocuments)
        .set({ status: "failed", error: `Couldn't queue indexing: ${reason}`, updatedAt: new Date() })
        .where(and(eq(kbDocuments.id, documentId), sql`${kbDocuments.orgId} = (select app.current_org_id())`)),
    );
  }
}

/** Add a text or URL source. (PDFs come through addPdfDocument after upload.) */
export async function addDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sourceType = (String(formData.get("sourceType") ?? "text") as KbSourceType) || "text";
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const values: AddValues = { sourceType, title, text, url };

  const errors: AddErrors = {};
  if (!title) errors.title = "Give this a title.";
  if (sourceType === "text" && !text) errors.text = "Paste some text to add.";
  if (sourceType === "url") {
    if (!url) errors.url = "Enter a URL.";
    else if (!isHttpUrl(url)) errors.url = "Enter a valid http(s) URL.";
  }
  if (Object.keys(errors).length > 0) return { errors, values };

  try {
    await requireRole("admin");
    const org = await orgId();
    const [doc] = await withOrg((tx) =>
      tx
        .insert(kbDocuments)
        .values({
          orgId: org,
          title,
          sourceType,
          sourceRef: sourceType === "text" ? text : url,
          status: "pending",
        })
        .returning({ id: kbDocuments.id }),
    );
    if (!doc) return { error: "Could not save the document.", values };
    await fireIngest(org, doc.id);
    revalidatePath("/workspace/knowledge");
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong"), values };
  }
}

/** Register an already-uploaded PDF (R2 key) and kick off ingestion. */
export async function addPdfDocument(params: {
  title: string;
  r2Key: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole("admin");
    const org = await orgId();
    const title = params.title.trim() || "Untitled PDF";
    const [doc] = await withOrg((tx) =>
      tx
        .insert(kbDocuments)
        .values({ orgId: org, title, sourceType: "pdf", sourceRef: params.r2Key, status: "pending" })
        .returning({ id: kbDocuments.id }),
    );
    if (!doc) return { ok: false, error: "Could not save the document." };
    // The upload finished (we have the key), so the Files ledger row is stored.
    // Tenants can only read `files` (RLS), so this goes through the service
    // path, scoped to the org in code like the confirm route.
    await withService((tx) =>
      tx
        .update(files)
        .set({ status: "uploaded", updatedAt: new Date() })
        .where(and(eq(files.r2Key, params.r2Key), eq(files.orgId, org))),
    );
    await fireIngest(org, doc.id);
    revalidatePath("/workspace/knowledge");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: safeErrorMessage(error, "Something went wrong") };
  }
}

/** Re-run ingestion for a document (e.g. after a failure). */
export async function reingestDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireRole("admin");
    const org = await orgId();
    const id = String(formData.get("id") ?? "");
    const [doc] = await withOrg((tx) =>
      tx
        .update(kbDocuments)
        .set({ status: "pending", error: null, updatedAt: new Date() })
        .where(and(eq(kbDocuments.id, id), sql`${kbDocuments.orgId} = (select app.current_org_id())`))
        .returning({ id: kbDocuments.id }),
    );
    if (doc) await fireIngest(org, doc.id);
    revalidatePath("/workspace/knowledge");
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong") };
  }
}

export async function deleteDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireRole("admin");
    const org = await orgId();
    const id = String(formData.get("id") ?? "");
    // Chunks cascade with the document row; a PDF also owns an R2 object and a
    // Files ledger row, which go with it.
    const [doc] = await withOrg((tx) =>
      tx
        .delete(kbDocuments)
        .where(and(eq(kbDocuments.id, id), sql`${kbDocuments.orgId} = (select app.current_org_id())`))
        .returning({ sourceType: kbDocuments.sourceType, sourceRef: kbDocuments.sourceRef }),
    );
    if (doc?.sourceType === "pdf" && doc.sourceRef) {
      const key = doc.sourceRef;
      try {
        await deleteObject(key);
      } catch (err) {
        Sentry.captureException(err); // the row is gone; an orphaned object is a cleanup, not a failure
      }
      await withService((tx) => tx.delete(files).where(and(eq(files.r2Key, key), eq(files.orgId, org))));
    }
    revalidatePath("/workspace/knowledge");
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Something went wrong") };
  }
}

// ── Passages (chunks): view, edit, delete ────────────────────────────────

export type ChunkView = { id: string; index: number; content: string; edited: boolean };
export type ChunkPage = { chunks: ChunkView[]; total: number; page: number; pages: number; title: string };
export type ChunkResult = { ok?: boolean; error?: string };

const inOrg = sql`(select app.current_org_id())`;

/** One page of a document's passages, in order. Bounded per document, so a plain offset is fine here. */
export async function loadChunks(documentId: string, page: number): Promise<ChunkPage | { error: string }> {
  try {
    await requireRole("admin");
    const p = Math.max(1, Math.floor(page) || 1);
    const [doc] = await withOrg((tx) =>
      tx.select({ title: kbDocuments.title }).from(kbDocuments).where(and(eq(kbDocuments.id, documentId), sql`${kbDocuments.orgId} = ${inOrg}`)).limit(1),
    );
    if (!doc) return { error: "That document no longer exists." };
    const where = and(eq(kbChunks.documentId, documentId), sql`${kbChunks.orgId} = ${inOrg}`);
    const [rows, [{ n } = { n: 0 }]] = await Promise.all([
      withOrg((tx) =>
        tx
          .select({ id: kbChunks.id, index: kbChunks.chunkIndex, content: kbChunks.content, editedAt: kbChunks.editedAt })
          .from(kbChunks)
          .where(where)
          .orderBy(asc(kbChunks.chunkIndex))
          .limit(CHUNKS_PER_PAGE)
          .offset((p - 1) * CHUNKS_PER_PAGE),
      ),
      withOrg((tx) => tx.select({ n: count() }).from(kbChunks).where(where)),
    ]);
    return {
      chunks: rows.map((r) => ({ id: r.id, index: r.index, content: r.content, edited: r.editedAt != null })),
      total: n,
      page: p,
      pages: Math.max(1, Math.ceil(n / CHUNKS_PER_PAGE)),
      title: doc.title,
    };
  } catch (error) {
    return { error: safeErrorMessage(error, "Could not load the passages.") };
  }
}

async function audit(action: string, target: string, metadata: Record<string, unknown>) {
  const [me, org] = await Promise.all([getCurrentUser(), getCurrentOrg()]);
  if (org) await recordAudit({ orgId: org.id, actorUserId: me?.id ?? null, action, target, metadata });
}

/** Save an edited passage. Re-embeds first: if Voyage fails nothing changes, so the search never drifts from the text. */
export async function saveChunk(chunkId: string, content: string): Promise<ChunkResult> {
  const clean = cleanChunk(content);
  if (!clean.ok) return { error: clean.error };
  try {
    await requireRole("admin");
    const [vector] = await embedDocuments([clean.text]);
    if (!vector) return { error: "Could not index the new text. Try again." };
    const [row] = await withOrg((tx) =>
      tx
        .update(kbChunks)
        .set({ content: clean.text, embedding: vector, embeddingModel: EMBEDDING_MODEL, editedAt: new Date() })
        .where(and(eq(kbChunks.id, chunkId), sql`${kbChunks.orgId} = ${inOrg}`))
        .returning({ documentId: kbChunks.documentId }),
    );
    if (!row) return { error: "That passage no longer exists." };
    await audit("kb.chunk_edited", chunkId, { document: row.documentId });
    return { ok: true };
  } catch (error) {
    Sentry.captureException(error);
    return { error: safeErrorMessage(error, "Could not save the passage.") };
  }
}

/** Remove one passage and keep the document's count in step. */
export async function deleteChunk(chunkId: string): Promise<ChunkResult> {
  try {
    await requireRole("admin");
    const [row] = await withOrg((tx) =>
      tx.delete(kbChunks).where(and(eq(kbChunks.id, chunkId), sql`${kbChunks.orgId} = ${inOrg}`)).returning({ documentId: kbChunks.documentId }),
    );
    if (!row) return { error: "That passage no longer exists." };
    await withOrg((tx) =>
      tx
        .update(kbDocuments)
        .set({ chunkCount: sql`greatest(${kbDocuments.chunkCount} - 1, 0)`, updatedAt: new Date() })
        .where(and(eq(kbDocuments.id, row.documentId), sql`${kbDocuments.orgId} = ${inOrg}`)),
    );
    await audit("kb.chunk_deleted", chunkId, { document: row.documentId });
    revalidatePath("/workspace/knowledge");
    return { ok: true };
  } catch (error) {
    return { error: safeErrorMessage(error, "Could not delete the passage.") };
  }
}
