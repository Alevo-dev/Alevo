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

import { markPlainHeadings } from "./plain-headings";

const HEADING = /^(#{1,6}) +(.+)$/;
/** A section with less body than this is carried into the next one instead of becoming a tiny chunk. */
const MIN_SECTION = 200;

function headingLine(path: string[]): string {
  return path.length ? `${"#".repeat(path.length)} ${path[path.length - 1]}\n` : "";
}

/**
 * Split on headings: each chunk is one section (or a few tiny ones together), started by its heading path
 * ("Pricing › Website plan") so it makes sense on its own and matches searches for that topic. A section longer than
 * a chunk is split by `chunkText`, every piece keeping the path. Headings are the `#` lines (a web page, a PDF read
 * by `pdfToMarkdown`, markdown); plain text with none gets its ALL-CAPS / numbered lines promoted first
 * (`markPlainHeadings`). With fewer than two headings either way it falls back to `chunkText`.
 */
export function chunkByHeadings(input: string): string[] {
  let clean = input.replace(/\r\n/g, "\n").trim();
  const count = (t: string) => t.split("\n").filter((l) => HEADING.test(l)).length;
  if (count(clean) < 2) clean = markPlainHeadings(clean);
  if (count(clean) < 2) return chunkText(clean);
  const lines = clean.split("\n");

  type Section = { path: string[]; body: string[] };
  const sections: Section[] = [{ path: [], body: [] }];
  const stack: { level: number; title: string }[] = [];
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (!m) {
      sections[sections.length - 1]!.body.push(line);
      continue;
    }
    const level = m[1]!.length;
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    stack.push({ level, title: m[2]!.trim() });
    sections.push({ path: stack.map((s) => s.title), body: [] });
  }

  const out: string[] = [];
  let carry = ""; // tiny sections waiting for the next one
  for (const s of sections) {
    const body = s.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!body) continue; // a heading with nothing under it: its title is already in the next path
    const own = `${headingLine(s.path)}${body}`;
    const text = carry ? `${carry}\n\n${own}` : body;
    if (body.length < MIN_SECTION && text.length < MAX_CHARS / 2) {
      carry = carry ? text : own;
      continue;
    }
    carry = "";
    const head = s.path.length ? `${s.path.join(" › ")}\n\n` : "";
    if (head.length + text.length <= MAX_CHARS) out.push(`${head}${text}`);
    else for (const piece of chunkText(text)) out.push(`${head}${piece}`);
  }
  if (carry) out.push(carry);
  return out;
}
