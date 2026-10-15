import "server-only";
import { and, eq } from "drizzle-orm";
import { kbChunks, kbDocuments, withService } from "@alevo/db";
import { embedDocuments } from "./embeddings";
import { chunkText } from "./chunk";
import { extractPdf, extractUrl } from "./extract";

export type IngestResult = { status: string; chunks?: number; error?: string };

/**
 * Ingest one KB document: extract → chunk → embed → store. Idempotent
 * (delete-then-insert the doc's chunks), so a stepless Inngest retry is safe.
 * Scoped to the org in code (service path).
 */
export async function ingestDocument(orgId: string, documentId: string): Promise<IngestResult> {
  const scoped = and(eq(kbDocuments.id, documentId), eq(kbDocuments.orgId, orgId));

  const [doc] = await withService((tx) => tx.select().from(kbDocuments).where(scoped).limit(1));
  if (!doc) return { status: "not-found" };

  try {
    await withService((tx) =>
      tx.update(kbDocuments).set({ status: "processing", error: null, updatedAt: new Date() }).where(scoped),
    );

    const ref = doc.sourceRef ?? "";
    let text = "";
    if (doc.sourceType === "text") text = ref;
    else if (doc.sourceType === "url") text = await extractUrl(ref);
    else if (doc.sourceType === "pdf") text = await extractPdf(ref);

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await withService((tx) =>
        tx
          .update(kbDocuments)
          .set({ status: "failed", error: "No text could be extracted.", chunkCount: 0, updatedAt: new Date() })
          .where(scoped),
      );
      return { status: "failed", error: "no-text" };
    }

    const vectors = await embedDocuments(chunks);

    await withService(async (tx) => {
      await tx.delete(kbChunks).where(and(eq(kbChunks.documentId, documentId), eq(kbChunks.orgId, orgId)));
      await tx.insert(kbChunks).values(
        chunks.map((content, i) => ({
          orgId,
          documentId,
          chunkIndex: i,
          content,
          embedding: vectors[i],
        })),
      );
      await tx
        .update(kbDocuments)
        .set({ status: "ready", chunkCount: chunks.length, error: null, updatedAt: new Date() })
        .where(scoped);
    });

    return { status: "ready", chunks: chunks.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Ingestion failed";
    await withService((tx) =>
      tx.update(kbDocuments).set({ status: "failed", error, updatedAt: new Date() }).where(scoped),
    );
    return { status: "failed", error };
  }
}
