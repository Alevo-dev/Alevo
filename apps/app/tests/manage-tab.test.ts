import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Members and General live in the Workspace → Manage tab, not behind the workspace picker. */
describe("Manage tab", () => {
  it("is a Workspace sub-menu entry with its own page", () => {
    expect(read("components/workspace-subnav.tsx")).toContain('href: "/workspace/manage"');
    expect(read("app/(app)/workspace/manage/page.tsx")).toContain("canEdit");
  });
  it("the workspace picker no longer opens a Manage dialog", () => {
    expect(read("components/workspace-switcher.tsx")).not.toMatch(/OrganizationDialog|manageOpen/);
  });
  it("editing controls only render for admins and owners", () => {
    const members = read("components/workspace/members-tab.tsx");
    expect(members).toContain("canEdit &&");
    expect(read("components/workspace/general-tab.tsx")).toContain("canEdit &&");
  });
});
