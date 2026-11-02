import { describe, expect, it } from "vitest";
import { canChangeRole, canRemove } from "../lib/members/guards";

/** Who the Members tab may touch: never an Alevo support row, never the last real owner. */
describe("member guards", () => {
  it("refuse to change or remove an Alevo support member", () => {
    const support = { role: "admin", support: true } as const;
    expect(canChangeRole(support)).toBe("Alevo support members are managed by Alevo.");
    expect(canRemove(support, 3)).toBe("Alevo support members are managed by Alevo.");
  });

  it("refuse to remove the last owner", () => {
    expect(canRemove({ role: "owner", support: false }, 0)).toBe("Cannot remove the last owner");
    expect(canRemove({ role: "owner", support: false }, 1)).toBeNull();
  });

  it("allow ordinary members", () => {
    expect(canChangeRole({ role: "rep", support: false })).toBeNull();
    expect(canRemove({ role: "rep", support: false }, 0)).toBeNull();
  });
});
