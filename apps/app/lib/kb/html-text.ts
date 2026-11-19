/** Strip HTML to readable text (best-effort; no DOM, regex-based). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: [RegExp, string][] = [
  [/&nbsp;/g, " "],
  [/&amp;/g, "&"],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&#39;|&apos;/g, "'"],
  [/&quot;/g, '"'],
];

function plain(fragment: string): string {
  let t = fragment.replace(/<[^>]+>/g, " ");
  for (const [re, to] of ENTITIES) t = t.replace(re, to);
  return t.replace(/\s+/g, " ").trim();
}

/**
 * A web page as markdown-ish text for the knowledge base: the page's own content only, with its headings kept as
 * `#` lines so the chunker can split on them. Navigation, footers, sidebars, forms and scripts are dropped, and
 * when the page has a `<main>` only that is read. Best-effort and regex-based (no DOM), like `htmlToText`.
 */
export function htmlToMarkdown(html: string): string {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|form|nav|footer|aside)\b[\s\S]*?<\/\1>/gi, " ")
    // A site header (logo + menu) goes; a <header> with no menu inside is usually a page or article title block, so it stays.
    .replace(/<header\b(?:(?!<\/header>)[\s\S])*?<nav\b[\s\S]*?<\/header>/gi, " ");
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(h);
  if (main?.[1]) h = main[1];

  h = h
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
      const title = plain(inner);
      return title ? `\n\n${"#".repeat(Number(level))} ${title}\n\n` : "\n";
    })
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|section|article|ul|ol|table|tr|blockquote)>|<br\s*\/?>/gi, "\n");

  let t = h.replace(/<[^>]+>/g, " ");
  for (const [re, to] of ENTITIES) t = t.replace(re, to);
  return t
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
