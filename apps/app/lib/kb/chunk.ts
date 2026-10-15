/**
 * Split text into overlapping chunks for embedding. Paragraph-aware: packs
 * paragraphs up to ~MAX_CHARS, carries a small overlap for context continuity,
 * and hard-splits any single oversized paragraph.
 */
const MAX_CHARS = 1500;
const OVERLAP = 200;

export function chunkText(input: string): string[] {
  const clean = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const paras = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const trimmed = buf.trim();
    if (trimmed) chunks.push(trimmed);
    // Carry the tail as overlap into the next chunk.
    buf = trimmed.length > OVERLAP ? trimmed.slice(trimmed.length - OVERLAP) : "";
  };

  for (const para of paras) {
    if (buf && buf.length + para.length + 2 > MAX_CHARS) flush();
    buf = buf ? `${buf}\n\n${para}` : para;
    // A single paragraph larger than the window: hard-split it.
    while (buf.length > MAX_CHARS) {
      chunks.push(buf.slice(0, MAX_CHARS).trim());
      buf = buf.slice(MAX_CHARS - OVERLAP);
    }
  }
  const tail = buf.trim();
  if (tail) chunks.push(tail);
  return chunks;
}
