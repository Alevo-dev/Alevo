/**
 * A PDF's own structure, from its text positions: headings are the lines set larger than the body text, and the
 * running header / footer / page number that repeats on every page is dropped. Pure (the caller reads the PDF), so
 * it is testable. Returns markdown-ish text (`#` lines) for the heading-aware chunker, or null when the file shows no
 * headings, in which case the caller keeps the plain extraction.
 */
export type PdfItem = { str: string; size: number; y: number };
export type PdfPage = { height: number; items: PdfItem[] };

type Line = { text: string; size: number; y: number; page: number; gap: number };

const MARGIN = 0.1; // the top and bottom tenth of a page: where running headers and footers live
const MAX_HEADING = 120;

/** Items on one baseline become a line; a jump in y starts the next. `gap` is the space above it, in line heights. */
function toLines(page: PdfPage, pageNo: number): Line[] {
  const lines: Line[] = [];
  let cur: { parts: string[]; size: number; y: number } | null = null;
  const flush = () => {
    if (!cur) return;
    const text = cur.parts.join("").replace(/\s+/g, " ").trim();
    if (text) {
      const prev = lines[lines.length - 1];
      const gap = prev && prev.page === pageNo ? Math.abs(prev.y - cur.y) / Math.max(cur.size, 1) : 0;
      lines.push({ text, size: cur.size, y: cur.y, page: pageNo, gap });
    }
    cur = null;
  };
  for (const it of page.items) {
    if (!it.str) continue;
    if (cur && Math.abs(it.y - cur.y) > cur.size * 0.5) flush();
    if (!cur) cur = { parts: [], size: it.size, y: it.y };
    cur.parts.push(it.str);
    if (it.str.trim()) cur.size = Math.max(cur.size, it.size);
  }
  flush();
  return lines;
}

/** The size most of the text is set in (by characters), rounded to half points. */
function bodySize(lines: Line[]): number {
  const by = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.size * 2) / 2;
    by.set(k, (by.get(k) ?? 0) + l.text.length);
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

const norm = (t: string) => t.toLowerCase().replace(/\d+/g, "#");

/** Lines in a page margin that repeat on three or more pages (and bare page numbers) are furniture, not content. */
function dropFurniture(lines: Line[], pages: PdfPage[]): Line[] {
  const seen = new Map<string, Set<number>>();
  const inMargin = (l: Line) => {
    const h = pages[l.page]?.height ?? 0;
    return h > 0 && (l.y < h * MARGIN || l.y > h * (1 - MARGIN));
  };
  for (const l of lines) {
    if (!inMargin(l)) continue;
    const k = norm(l.text);
    (seen.get(k) ?? seen.set(k, new Set()).get(k)!).add(l.page);
  }
  return lines.filter((l) => {
    if (!inMargin(l)) return true;
    if (/^\W*\d+\W*$/.test(l.text)) return false;
    return (seen.get(norm(l.text))?.size ?? 0) < 3;
  });
}

export function pdfToMarkdown(pages: PdfPage[]): string | null {
  const all = dropFurniture(pages.flatMap((p, i) => toLines(p, i)), pages);
  const body = bodySize(all);
  if (!body) return null;

  const isHeading = (l: Line) => l.size >= body * 1.12 && l.text.length <= MAX_HEADING && !/[.,;:]$/.test(l.text);
  const sizes = [...new Set(all.filter(isHeading).map((l) => Math.round(l.size * 2) / 2))].sort((a, b) => b - a);
  if (all.filter(isHeading).length < 2) return null;
  const level = (l: Line) => Math.min(sizes.indexOf(Math.round(l.size * 2) / 2) + 1, 4);

  const out: string[] = [];
  let para = "";
  const endPara = () => {
    if (para.trim()) out.push(para.trim());
    para = "";
  };
  for (const l of all) {
    if (isHeading(l)) {
      endPara();
      // Wrapped headings (two lines of the same size) are one heading.
      const last = out[out.length - 1];
      if (last?.startsWith(`${"#".repeat(level(l))} `) && l.gap < 1.6 && out.length) out[out.length - 1] = `${last} ${l.text}`;
      else out.push(`${"#".repeat(level(l))} ${l.text}`);
      continue;
    }
    if (l.gap > 1.8) endPara();
    // A hyphen at a line end joins the word; otherwise lines of a paragraph join with a space.
    para = /[a-z]-$/.test(para) ? `${para.slice(0, -1)}${l.text}` : para ? `${para} ${l.text}` : l.text;
  }
  endPara();
  return out.join("\n\n");
}
