/**
 * Re-embed every KB chunk that was not made by the current embedding model
 * (`EMBEDDING_MODEL`), from the chunk text already stored: no PDF / URL fetching.
 * Run after changing the model, once the migration is applied. Safe to re-run;
 * a chunk is only touched while its `embedding_model` differs.
 *
 *   cd packages/db && pnpm exec tsx --conditions=react-server \
 *     --tsconfig ../../apps/app/tsconfig.json --env-file=../../apps/app/.env.local \
 *     ../../apps/app/scripts/reembed-kb.ts
 *
 * Small batches with a pause between them keep an account without a payment
 * method (3 requests and 10K tokens per minute) under its limit.
 */
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { kbChunks, withService } from "@alevo/db";
import { EMBEDDING_MODEL, embedDocuments } from "../lib/kb/embeddings";

const BATCH = 20;
const PAUSE_MS = 21_000;


async function main() {
  const stale = or(isNull(kbChunks.embeddingModel), ne(kbChunks.embeddingModel, EMBEDDING_MODEL));
  const todo = await withService((tx) => tx.select({ id: kbChunks.id, orgId: kbChunks.orgId, content: kbChunks.content }).from(kbChunks).where(stale));
  console.log(`${todo.length} chunk(s) to re-embed with ${EMBEDDING_MODEL}`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const rows = todo.slice(i, i + BATCH);
    const vectors = await embedDocuments(rows.map((r) => r.content));
    await withService(async (tx) => {
      for (const [j, row] of rows.entries()) {
        await tx
          .update(kbChunks)
          .set({ embedding: vectors[j], embeddingModel: EMBEDDING_MODEL })
          .where(and(eq(kbChunks.id, row.id), eq(kbChunks.orgId, row.orgId), stale));
      }
    });
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    if (i + BATCH < todo.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  console.log("done");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
