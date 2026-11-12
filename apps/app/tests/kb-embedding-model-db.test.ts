import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { kbChunks, kbDocuments, organizations, withService } from "@alevo/db";
import { EMBEDDING_MODEL } from "../lib/kb/embeddings";
import { nearestChunks } from "../lib/kb/retrieve";

/**
 * Vectors from different embedding models can't be compared (migration 0040), so
 * a search only considers chunks made by the current model. Real Postgres.
 */

const ORG = "org_test_kb_model";
let orgId: string;

const vec = (axis: number) => Array.from({ length: 1024 }, (_, i) => (i === axis ? 1 : 0));

async function cleanup() {
  await withService((tx) => tx.delete(organizations).where(sql`${organizations.clerkId} = ${ORG}`)); // cascades
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must point at Postgres with migration 0040 applied");
  await cleanup();
  const [org] = await withService((tx) => tx.insert(organizations).values({ clerkId: ORG, name: "KB model" }).returning({ id: organizations.id }));
  orgId = org!.id;
  const [doc] = await withService((tx) =>
    tx.insert(kbDocuments).values({ orgId, title: "Doc", sourceType: "text", sourceRef: "x", status: "ready" }).returning({ id: kbDocuments.id }),
  );
  // Same direction as the query, so it would be the top hit if the model were ignored.
  await withService((tx) =>
    tx.insert(kbChunks).values([
      { orgId, documentId: doc!.id, chunkIndex: 0, content: "made by the old model", embedding: vec(0), embeddingModel: "voyage-3.5-lite" },
      { orgId, documentId: doc!.id, chunkIndex: 1, content: "made by the current model", embedding: vec(0), embeddingModel: EMBEDDING_MODEL },
    ]),
  );
});

afterAll(cleanup);

describe("nearestChunks", () => {
  it("only returns chunks embedded by the current model", async () => {
    expect(await nearestChunks(orgId, vec(0), 5)).toEqual(["made by the current model"]);
  });
});
