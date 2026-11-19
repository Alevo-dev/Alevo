import { describe, expect, it } from "vitest";
import { chunkByHeadings } from "../lib/kb/chunk";
import { markPlainHeadings } from "../lib/kb/plain-headings";
import { pdfToMarkdown, type PdfPage } from "../lib/kb/pdf-structure";

const pad = (s: string) => `${s} ${"detail ".repeat(40)}`.trim();

/** A page: [text, size, y] lines from the top down; pages are 800 tall. */
const page = (...lines: [string, number, number][]): PdfPage => ({ height: 800, items: lines.map(([str, size, y]) => ({ str, size, y })) });

describe("pdfToMarkdown", () => {
  const pages = [
    page(["Acme handbook", 10, 780], ["Pricing", 20, 700], ["Our plans start at nine dollars.", 11, 670], ["They include hosting.", 11, 656], ["Website plan", 15, 600], ["Includes a site.", 11, 570], ["Page 1", 10, 20]),
    page(["Acme handbook", 10, 780], ["Support", 20, 700], ["We answer within a day.", 11, 670], ["Page 2", 10, 20]),
    page(["Acme handbook", 10, 780], ["More body text here for the third page.", 11, 700], ["Page 3", 10, 20]),
  ];
  const md = pdfToMarkdown(pages) ?? "";
  it("turns larger text into headings, biggest first", () => {
    expect(md).toContain("# Pricing");
    expect(md).toContain("## Website plan");
    expect(md).toContain("# Support");
  });
  it("joins the lines of a paragraph", () => {
    expect(md).toContain("Our plans start at nine dollars. They include hosting.");
  });
  it("drops the running header and the page numbers", () => {
    expect(md).not.toMatch(/Acme handbook|Page \d/);
  });
  it("returns null when nothing stands out as a heading", () => {
    expect(pdfToMarkdown([page(["Just body.", 11, 700], ["More body.", 11, 680])])).toBeNull();
  });
});

describe("markPlainHeadings", () => {
  it("promotes ALL CAPS and numbered lines that stand alone", () => {
    const t = `PRICING\n\nPlans from nine dollars.\n\n2.1 Website plan\n\nIncludes a site.`;
    expect(markPlainHeadings(t)).toBe(`# PRICING\n\nPlans from nine dollars.\n\n## 2.1 Website plan\n\nIncludes a site.`);
  });
  it("leaves ordinary text alone", () => {
    const t = "Hello there.\n\nWhat do you charge?\n\nNine dollars.";
    expect(markPlainHeadings(t)).toBe(t);
  });
  it("needs at least two headings", () => {
    expect(markPlainHeadings("PRICING\n\nPlans from nine dollars.")).toBe("PRICING\n\nPlans from nine dollars.");
  });
  it("feeds the heading chunker", () => {
    const chunks = chunkByHeadings(`PRICING\n\n${pad("Plans.")}\n\nSUPPORT\n\n${pad("Help.")}`);
    expect(chunks.map((c) => c.split("\n")[0])).toEqual(["PRICING", "SUPPORT"]);
  });
});
