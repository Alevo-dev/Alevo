import { beforeAll, describe, expect, it } from "vitest";
import { checkUpload } from "@/lib/files/rules";
import { presignPutUrl } from "@/lib/r2";

const MB = 1024 * 1024;

describe("checkUpload", () => {
  it("accepts a PDF for the knowledge base up to 25MB", () => {
    expect(checkUpload("knowledge", "application/pdf", 3 * MB)).toBeNull();
    expect(checkUpload("knowledge", "application/pdf", 25 * MB)).toBeNull();
  });

  it("rejects anything over the purpose's size limit", () => {
    expect(checkUpload("knowledge", "application/pdf", 25 * MB + 1)).toMatch(/25 ?MB/i);
    expect(checkUpload("avatar", "image/png", 5 * MB + 1)).toMatch(/5 ?MB/i);
  });

  it("requires a real size: missing, zero, negative, fractional or not a number", () => {
    for (const bad of [undefined, null, 0, -1, 1.5, Number.NaN, "100"]) {
      expect(checkUpload("knowledge", "application/pdf", bad)).not.toBeNull();
    }
  });

  it("rejects a content type the purpose does not take", () => {
    expect(checkUpload("knowledge", "text/html", MB)).toMatch(/not allowed/i);
    expect(checkUpload("knowledge", "application/octet-stream", MB)).not.toBeNull();
  });

  it("never takes SVG or HTML as an image (script in a file we serve)", () => {
    for (const purpose of ["file", "image", "avatar", "logo"] as const) {
      expect(checkUpload(purpose, "image/svg+xml", 1000)).not.toBeNull();
      expect(checkUpload(purpose, "text/html", 1000)).not.toBeNull();
    }
  });

  it("matches the content type case-insensitively and ignores parameters", () => {
    expect(checkUpload("logo", "IMAGE/PNG; charset=binary", MB)).toBeNull();
  });
});

describe("presignPutUrl", () => {
  beforeAll(() => {
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET = "bucket";
  });

  it("binds the content type and the exact length into the signature, so the URL cannot upload anything else", async () => {
    const url = new URL(await presignPutUrl("organizations/o/knowledge/x.pdf", "application/pdf", 1234));
    const signed = (url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
    expect(signed).toEqual(expect.arrayContaining(["content-length", "content-type", "host"]));
  });
});
