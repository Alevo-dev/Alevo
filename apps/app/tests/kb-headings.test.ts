import { describe, expect, it } from "vitest";
import { chunkByHeadings } from "../lib/kb/chunk";
import { htmlToMarkdown } from "../lib/kb/html-text";

const pad = (s: string) => `${s} ${"detail ".repeat(40)}`.trim();

describe("htmlToMarkdown", () => {
  const page = `<html><body>
    <header><a href="/">Logo</a><nav><a>Home</a><a>Pricing</a></nav></header>
    <main><h1>Web design</h1><p>We build sites.</p><h2>Plans &amp; pricing</h2><ul><li>Basic</li><li>Pro</li></ul></main>
    <footer>Copyright 2026 Privacy Terms</footer><script>var x=1</script></body></html>`;
  it("keeps headings as # lines and lists, drops nav, footer and scripts", () => {
    const md = htmlToMarkdown(page);
    expect(md).toContain("# Web design");
    expect(md).toContain("## Plans & pricing");
    expect(md).toContain("- Basic");
    expect(md).not.toMatch(/Logo|Home|Copyright|var x/);
  });
  it("without <main>, still drops nav and footer", () => {
    const md = htmlToMarkdown("<body><nav>Menu</nav><h1>Hi</h1><p>Body</p><footer>Foot</footer></body>");
    expect(md).toContain("# Hi");
    expect(md).not.toMatch(/Menu|Foot/);
  });
  it("keeps a <header> that holds a page title and no menu", () => {
    expect(htmlToMarkdown("<header><h1>Our story</h1></header><p>Text</p>")).toContain("# Our story");
  });
});

describe("chunkByHeadings", () => {
  it("one chunk per section, each starting with its heading path", () => {
    const md = `# Services\n\n${pad("Intro.")}\n\n## Websites\n\n${pad("Sites.")}\n\n## Booking\n\n${pad("Bookings.")}`;
    const chunks = chunkByHeadings(md);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.startsWith("Services\n")).toBe(true);
    expect(chunks[1]!.startsWith("Services › Websites\n")).toBe(true);
    expect(chunks[2]!.startsWith("Services › Booking\n")).toBe(true);
  });
  it("a sibling heading replaces the previous one in the path", () => {
    const md = `# A\n\n## One\n\n${pad("x")}\n\n# B\n\n${pad("y")}`;
    expect(chunkByHeadings(md).map((c) => c.split("\n")[0])).toEqual(["A › One", "B"]);
  });
  it("carries a tiny section into the next instead of making a tiny chunk", () => {
    const md = `# Page\n\n## Tagline\n\nGet found.\n\n## Plans\n\n${pad("Plans.")}`;
    const chunks = chunkByHeadings(md);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Get found.");
    expect(chunks[0]).toContain("Plans.");
  });
  it("splits a long section into pieces that each keep the path", () => {
    const long = Array.from({ length: 12 }, (_, i) => pad(`Paragraph ${i}.`)).join("\n\n");
    const chunks = chunkByHeadings(`# Big\n\n${long}\n\n# Other\n\n${pad("z")}`);
    const big = chunks.filter((c) => c.startsWith("Big\n"));
    expect(big.length).toBeGreaterThan(1);
    expect(big.every((c) => c.length <= 1700)).toBe(true);
  });
  it("falls back to the plain split with fewer than two headings", () => {
    expect(chunkByHeadings("Just some notes.\n\nMore notes.")).toEqual(["Just some notes.\n\nMore notes."]);
  });
});
