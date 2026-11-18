/**
 * The agent's messages never carry long dashes: the prompt asks for full sentences, and this is the net under it
 * (models reach for an em dash out of habit). A dash before a new sentence becomes a full stop, one inside a sentence
 * a comma, and a range like 9am–12pm reads "9am to 12pm". Hyphens inside words (follow-up) are left alone.
 */
export function plainPunctuation(text: string): string {
  return text
    .replace(/(\w)[–—](\w)/g, "$1 to $2")
    .replace(/\s*[—–]\s*$/, "")
    .replace(/(?:\s*[—–]\s*|\s+-\s+)(\S)/g, (_m, next: string, offset: number, whole: string) => {
      const before = whole[offset - 1] ?? "";
      if (/[.!?,:;]/.test(before)) return ` ${next}`;
      return `${/[A-Z]/.test(next) ? "." : ","} ${next}`;
    });
}
