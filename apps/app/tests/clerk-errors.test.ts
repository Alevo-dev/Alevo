import { describe, expect, it } from "vitest";
import { clerkRejection } from "../../../packages/auth/src/clerk-errors";

/** Clerk's backend errors carry the reason in `errors[0].longMessage`, not `message` (review finding #5). */
describe("clerkRejection", () => {
  const clerkError = {
    clerkError: true,
    status: 422,
    message: "Unprocessable Entity",
    errors: [{ code: "form_identifier_exists", message: "is taken", longMessage: "That email address is taken.", meta: { paramName: "email_address" } }],
  };

  it("reads the long message and the field it is about", () => {
    expect(clerkRejection(clerkError)).toEqual({ message: "That email address is taken.", param: "email_address" });
  });

  it("falls back to the short message, then a generic line", () => {
    expect(clerkRejection({ clerkError: true, errors: [{ code: "x", message: "nope" }] })).toEqual({ message: "nope", param: undefined });
    expect(clerkRejection({ clerkError: true, errors: [] })).toEqual({ message: "Clerk rejected the request.", param: undefined });
  });

  it("ignores ordinary errors", () => {
    expect(clerkRejection(new Error("boom"))).toBeNull();
    expect(clerkRejection("string")).toBeNull();
  });
});
