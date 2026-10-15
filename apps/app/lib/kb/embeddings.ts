import "server-only";

/**
 * Voyage AI embeddings (Anthropic's recommended RAG embeddings). Raw HTTP — no
 * official Node SDK. `voyage-3.5-lite` outputs 1024-dim vectors, matching the
 * `vector(1024)` column. Document and query embeddings use different input_type.
 */
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3.5-lite";
/** Max inputs per request; we batch larger sets. */
const BATCH = 96;

export const EMBEDDING_DIM = 1024;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: inputType }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embeddings failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  // The API preserves order, but sort by index defensively before dropping it.
  return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embed KB chunks (document input type), batched. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...(await embed(texts.slice(i, i + BATCH), "document")));
  }
  return out;
}

/** Embed a single retrieval query (query input type). */
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embed([text], "query");
  if (!vec) throw new Error("Voyage returned no embedding");
  return vec;
}
