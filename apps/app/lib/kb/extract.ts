import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { presignGetUrl } from "@/lib/r2";

/** Strip HTML to readable text (best-effort; no DOM, regex-based). */
function htmlToText(html: string): string {
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

/** Fetch a URL and return its visible text. */
export async function extractUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "AlevoBot/1.0 (+https://getalevo.com)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const html = await res.text();
  return htmlToText(html);
}

/** Fetch a PDF from R2 by object key and extract its text. */
export async function extractPdf(r2Key: string): Promise<string> {
  const url = await presignGetUrl(r2Key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n\n") : text).trim();
}
