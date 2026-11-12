/**
 * Knowledge base — docs + pgvector chunks. Typed mirror of migration 0010.
 *
 * The Qualifier retrieves the nearest chunks for an org and grounds its replies
 * in them. Embeddings are Voyage (1024-dim, cosine); `embedding_model` records which
 * model made each vector, because vectors from different models can't be compared.
 */
import { index, integer, pgEnum, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { organizations, timestamps } from "./identity";

export const kbSourceType = pgEnum("kb_source_type", ["text", "url", "pdf"]);
export const kbDocStatus = pgEnum("kb_doc_status", ["pending", "processing", "ready", "failed"]);

export const kbDocuments = pgTable(
  "kb_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceType: kbSourceType("source_type").notNull(),
    /** url | R2 object key | the pasted text itself (per sourceType). */
    sourceRef: text("source_ref"),
    status: kbDocStatus("status").notNull().default("pending"),
    error: text("error"),
    chunkCount: integer("chunk_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("kb_documents_org_id_idx").on(t.orgId)],
);

export const kbChunks = pgTable(
  "kb_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => kbDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    /** Model that produced `embedding`; retrieval only searches the current one. */
    embeddingModel: text("embedding_model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("kb_chunks_org_id_idx").on(t.orgId),
    index("kb_chunks_document_id_idx").on(t.documentId),
  ],
);

export type KbDocument = typeof kbDocuments.$inferSelect;
export type KbSourceType = (typeof kbSourceType.enumValues)[number];
export type KbDocStatus = (typeof kbDocStatus.enumValues)[number];
