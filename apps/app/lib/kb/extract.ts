import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { presignGetUrl } from "@/lib/r2";
import { vendorFetch } from "@/lib/http/vendor-fetch";
import { safeFetchHtml } from "@/lib/http/safe-fetch";
import { htmlToMarkdown } from "./html-text";
import { pdfToMarkdown, type PdfPage } from "./pdf-structure";

/** Fetch a user-supplied URL (public hosts only) and return its visible text. */
export async function extractUrl(url: string): Promise<string> {
  const { html } = await safeFetchHtml(url);
  return htmlToMarkdown(html);
}

/** Fetch a PDF from R2 by object key and extract its text. */
export async function extractPdf(r2Key: string): Promise<string> {
  const url = await presignGetUrl(r2Key);
  const res = await vendorFetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const pdf = await getDocumentProxy(bytes);
  // The page structure (heading sizes, repeated headers and footers) when the file shows any, else the plain text.
  const structured = pdfToMarkdown(await readPages(pdf));
  if (structured) return structured;
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n\n") : text).trim();
}

type Pdf = Awaited<ReturnType<typeof getDocumentProxy>>;

/** Each page's text with its size and position, for `pdfToMarkdown`. */
async function readPages(pdf: Pdf): Promise<PdfPage[]> {
  const pages: PdfPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const { items } = await page.getTextContent();
    pages.push({
      height: page.view[3] ?? 0,
      items: items.flatMap((it) =>
        "str" in it ? [{ str: it.str + (it.hasEOL ? " " : ""), size: Math.abs(it.transform[3] ?? it.height), y: it.transform[5] ?? 0 }] : [],
      ),
    });
  }
  return pages;
}
