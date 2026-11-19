import { describe, expect, it } from "vitest";
import { cleanChunk, MAX_CHUNK_CHARS } from "../lib/kb/chunk-edit";

describe("cleanChunk", () => {
  it("trims and collapses blank lines", () => {
    expect(cleanChunk("  a\r\n\n\n\nb  ")).toEqual({ ok: true, text: "a\n\nb" });
  });
  it("refuses empty text", () => {
    expect(cleanChunk("  \n ").ok).toBe(false);
  });
  it("refuses over the cap, accepts exactly the cap", () => {
    expect(cleanChunk("x".repeat(MAX_CHUNK_CHARS)).ok).toBe(true);
    expect(cleanChunk("x".repeat(MAX_CHUNK_CHARS + 1)).ok).toBe(false);
  });
});
