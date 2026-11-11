import { describe, expect, it } from "vitest";
import { pgErrorCode, safeErrorMessage } from "@alevo/db";

/** drizzle-orm 0.45 wraps driver errors in "Failed query"; the Postgres code sits on `.cause`. */
describe("pgErrorCode", () => {
  it("reads the code off a raw driver error", () => {
    expect(pgErrorCode(Object.assign(new Error("dup"), { code: "23505" }))).toBe("23505");
  });

  it("reads the code off a drizzle-wrapped error", () => {
    const wrapped = new Error("Failed query", { cause: Object.assign(new Error("dup"), { code: "23505" }) });
    expect(pgErrorCode(wrapped)).toBe("23505");
  });

  it("is undefined for anything else", () => {
    expect(pgErrorCode(new Error("boom"))).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
    expect(pgErrorCode("23505")).toBeUndefined();
  });
});

describe("safeErrorMessage", () => {
  it("passes an ordinary error's message through", () => {
    expect(safeErrorMessage(new Error("That time was just taken"), "fallback")).toBe("That time was just taken");
  });

  it("hides a drizzle-wrapped database error (its message holds the SQL and its parameters)", () => {
    const wrapped = new Error("Failed query: insert into \"contacts\" (...)\nparams: org-1,jane@example.com", {
      cause: Object.assign(new Error("dup"), { code: "23505" }),
    });
    expect(safeErrorMessage(wrapped, "Something went wrong")).toBe("Something went wrong");
  });

  it("hides a raw driver error that carries a SQLSTATE", () => {
    expect(safeErrorMessage(Object.assign(new Error('duplicate key value violates unique constraint "x"'), { code: "23505" }), "nope")).toBe("nope");
  });

  it("uses the fallback for non-errors", () => {
    expect(safeErrorMessage("boom", "fallback")).toBe("fallback");
  });
});

describe("errors that carry a non-SQLSTATE code", () => {
  it("keeps the readable message of an app error with its own string code (SafeFetchError)", () => {
    const e = Object.assign(new Error("That address is not allowed"), { code: "blocked" });
    expect(pgErrorCode(e)).toBeUndefined();
    expect(safeErrorMessage(e, "fallback")).toBe("That address is not allowed");
  });

  it("does not mistake a Node system error for a database error", () => {
    expect(pgErrorCode(Object.assign(new Error("operation not permitted"), { code: "EPERM" }))).toBeUndefined();
  });

  it("still recognises letter-bearing SQLSTATEs", () => {
    expect(pgErrorCode(Object.assign(new Error("x"), { code: "42P01" }))).toBe("42P01");
    expect(pgErrorCode(Object.assign(new Error("x"), { code: "XX000" }))).toBe("XX000");
  });
});
