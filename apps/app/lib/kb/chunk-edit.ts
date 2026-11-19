/** A hand-edited chunk may be up to twice the size ingest makes (1500), so one edit can't swamp retrieval. */
export const MAX_CHUNK_CHARS = 3000;
export const CHUNKS_PER_PAGE = 25;

export type CleanChunk = { ok: true; text: string } | { ok: false; error: string };

/** Tidy an edited chunk's text. Empty is refused here: removing a chunk is the Delete button, never an empty save. */
export function cleanChunk(input: string): CleanChunk {
  const text = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { ok: false, error: "A passage can't be empty. Use Delete to remove it." };
  if (text.length > MAX_CHUNK_CHARS) return { ok: false, error: `Keep it under ${MAX_CHUNK_CHARS} characters (it is ${text.length}).` };
  return { ok: true, text };
}
