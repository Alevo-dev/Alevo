import { describe, expect, it } from "vitest";
import { nextWorkspace } from "../lib/orgs/next-workspace";

const m = (id: string, role = "org:admin") => ({ organization: { id }, role });

/** After leaving or deleting a workspace the user lands in another one they belong to, owned ones first. */
describe("nextWorkspace", () => {
  it("skips the workspace just left, even if the list still shows it", () => {
    expect(nextWorkspace([m("org_gone"), m("org_b")], "org_gone")).toBe("org_b");
  });

  it("prefers a workspace the user owns", () => {
    expect(nextWorkspace([m("org_gone"), m("org_member"), m("org_owned", "org:owner")], "org_gone")).toBe("org_owned");
  });

  it("is null when nothing is left, so the caller signs out", () => {
    expect(nextWorkspace([m("org_gone")], "org_gone")).toBeNull();
    expect(nextWorkspace([], "org_gone")).toBeNull();
  });
});
