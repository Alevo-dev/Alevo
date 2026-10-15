import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { kbChunks, withService } from "@alevo/db";
import { embedQuery, isEmbeddingsConfigured } from "./embeddings";

/** Minimum cosine similarity for a chunk to be considered relevant. */
const MIN_SIMILARITY = 0.25;

/**
 * Top-k KB chunks most relevant to `query` for an org, as plain text. Best-effort:
 * returns [] when embeddings aren't configured, the query is empty, the org has
 * no KB, or anything fails — the Qualifier simply proceeds without grounding.
 */
export async function retrieveKbContext(orgId: string, query: string, k = 5): Promise<string[]> {
  if (!isEmbeddingsConfigured() || !query.trim()) return [];
  try {
    const vec = await embedQuery(query);
    // Bind the query vector as a pgvector literal with an explicit `::vector` cast.
    // drizzle's cosineDistance() binds the array as a text param, which Postgres
    // won't coerce to `vector` (no `vector <=> text` operator) — so the cast is
    // required, especially with prepare:false on the Supavisor pooler.
    const literal = `[${vec.join(",")}]`;
    const similarity = sql<number>`1 - (${kbChunks.embedding} <=> ${literal}::vector)`;
    const rows = await withService((tx) =>
      tx
        .select({ content: kbChunks.content, similarity })
        .from(kbChunks)
        .where(and(eq(kbChunks.orgId, orgId), gt(similarity, MIN_SIMILARITY)))
        .orderBy(desc(similarity))
        .limit(k),
    );
    return rows.map((r) => r.content);
  } catch (err) {
    // Best-effort: the Qualifier proceeds ungrounded. Log so it isn't invisible.
    console.error("[kb] retrieveKbContext failed:", err);
    return [];
  }
}
