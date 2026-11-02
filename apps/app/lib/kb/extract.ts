import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { presignGetUrl } from "@/lib/r2";
import { vendorFetch } from "@/lib/http/vendor-fetch";
import { safeFetchHtml } from "@/lib/http/safe-fetch";
import { htmlToText } from "./html-text";

/** Fetch a user-supplied URL (public hosts only) and return its visible text. */
export async function extractUrl(url: string): Promise<string> {
  const { html } = await safeFetchHtml(url);
  return htmlToText(html);
}

/** Fetch a PDF from R2 by object key and extract its text. */
export async function extractPdf(r2Key: string): Promise<string> {
  const url = await presignGetUrl(r2Key);
  const res = await vendorFetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n\n") : text).trim();
}
