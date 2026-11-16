import { describe, expect, it } from "vitest";
import { cleanWebsite } from "../lib/profile/website";

describe("cleanWebsite", () => {
  it("allows blank", () => {
    expect(cleanWebsite("  ")).toEqual({ value: null });
  });

  it("adds https to a bare domain and upgrades http", () => {
    expect(cleanWebsite("acme.com").value).toBe("https://acme.com");
    expect(cleanWebsite("http://www.acme.com/").value).toBe("https://www.acme.com");
  });

  it("keeps a path but drops query and fragment", () => {
    expect(cleanWebsite("https://acme.com/it/?a=1#x").value).toBe("https://acme.com/it");
  });

  it("rejects junk, other schemes, logins, private hosts", () => {
    for (const bad of ["not a url", "ftp://acme.com", "https://user:pw@acme.com", "localhost", "http://127.0.0.1", "https://10.0.0.5"]) {
      expect(cleanWebsite(bad).error, bad).toBeTruthy();
    }
  });

  it("rejects an address over 200 characters", () => {
    expect(cleanWebsite(`acme.com/${"a".repeat(200)}`).error).toMatch(/200/);
  });
});
