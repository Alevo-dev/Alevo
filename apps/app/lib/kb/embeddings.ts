import "server-only";
import { vendorFetch } from "@/lib/http/vendor-fetch";

/**
 * Voyage AI embeddings (Anthropic's recommended RAG embeddings). Raw HTTP — no
 * official Node SDK. `voyage-4-lite` is asked for 1024-dim vectors, matching the
 * `vector(1024)` column. Document and query embeddings use different input_type.
 * Vectors from different models are not comparable, so every stored chunk records
 * its model (`kb_chunks.embedding_model`) and a model change is a re-embed.
 */
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
/** The model that makes (and is searched for) every vector. */
export const EMBEDDING_MODEL = "voyage-4-lite";
const DIMENSIONS = 1024;
/** Max inputs per request; we batch larger sets. */
const BATCH = 96;
/** Batches in flight at once — enough to overlap network time without tripping rate limits. */
const CONCURRENCY = 4;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");

  const res = await vendorFetch(VOYAGE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL, input_type: inputType, output_dimension: DIMENSIONS }),
  }, { idempotent: true, retries: 3 }); // pure function of its input: safe to replay, and Voyage rate-limits (429)
  if (!res.ok) {
    throw new Error(`Voyage embeddings failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  // The API preserves order, but sort by index defensively before dropping it.
  return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embed KB chunks (document input type), batched, a few batches at a time. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) batches.push(texts.slice(i, i + BATCH));
  const out: number[][] = [];
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const results = await Promise.all(batches.slice(i, i + CONCURRENCY).map((b) => embed(b, "document")));
    for (const r of results) out.push(...r);
  }
  return out;
}

/** Embed a single retrieval query (query input type). */
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embed([text], "query");
  if (!vec) throw new Error("Voyage returned no embedding");
  return vec;
}
