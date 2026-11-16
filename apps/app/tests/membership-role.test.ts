import { describe, expect, it } from "vitest";
import { membershipFor } from "../lib/webhooks/membership-role";

/**
 * The rule for mirrored memberships: a platform admin is "support" with the admin
 * role (never owner, even as the org's creator) unless the org invited them with a
 * role; everyone else gets the invite's role, else creator → owner, else Clerk's role mapped.
 */
describe("membershipFor", () => {
  it("platform admin is support with the admin role, even as creator", () => {
    expect(membershipFor({ isPlatformAdmin: true, inviteRole: null, clerkRole: "org:admin", isCreator: true })).toEqual({
      role: "admin",
      support: true,
    });
  });

  it("a platform admin invited with a role is a real member with that role", () => {
    expect(membershipFor({ isPlatformAdmin: true, inviteRole: "owner", clerkRole: "org:admin", isCreator: false })).toEqual({
      role: "owner",
      support: false,
    });
  });

  it("creator becomes owner", () => {
    expect(membershipFor({ isPlatformAdmin: false, inviteRole: null, clerkRole: "org:admin", isCreator: true })).toEqual({
      role: "owner",
      support: false,
    });
  });

  it("invite role wins over the Clerk role", () => {
    expect(membershipFor({ isPlatformAdmin: false, inviteRole: "viewer", clerkRole: "org:admin", isCreator: false })).toEqual({
      role: "viewer",
      support: false,
    });
  });

  it("without an invite, org:admin maps to admin and org:member to rep", () => {
    expect(membershipFor({ isPlatformAdmin: false, inviteRole: null, clerkRole: "org:admin", isCreator: false }).role).toBe("admin");
    expect(membershipFor({ isPlatformAdmin: false, inviteRole: null, clerkRole: "org:member", isCreator: false }).role).toBe("rep");
  });
});
