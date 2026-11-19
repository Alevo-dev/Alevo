/**
 * Headings in text that has no markdown: a short line standing alone between blank lines that is either ALL CAPS or
 * numbered ("2. Pricing", "2.1 Website plan"). Deliberately narrow, because a wrong guess splits a paragraph; text
 * with no such lines is returned unchanged. Used only when the text has no `#` headings of its own.
 */
const NUMBERED = /^(\d+(?:\.\d+){0,3})[.)]?\s+\p{Lu}/u;
const END_PUNCT = /[.,;:?!]$/;

function levelOf(line: string): number | null {
  const t = line.trim();
  if (t.length < 3 || t.length > 80 || END_PUNCT.test(t)) return null;
  const num = NUMBERED.exec(t);
  if (num) return num[1]!.split(".").length;
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 3 && letters === letters.toUpperCase() && /\p{Lu}/u.test(letters)) return 1;
  return null;
}

export function markPlainHeadings(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let found = 0;
  const out = lines.map((line, i) => {
    const alone = (i === 0 || !lines[i - 1]!.trim()) && (i === lines.length - 1 || !lines[i + 1]!.trim());
    const level = alone ? levelOf(line) : null;
    if (level == null) return line;
    found++;
    return `${"#".repeat(level)} ${line.trim()}`;
  });
  return found >= 2 ? out.join("\n") : text;
}
