import { describe, expect, it } from "vitest";
import { checkReport, slackReport, slackEscape } from "../lib/support/report";

const ok = { title: "Booking button does nothing", what: "I click Reschedule and nothing opens.", steps: "" };
const ctx = { who: "Dana", email: "dana@x.co", role: "admin", workspace: "Acme", workspaceId: "abc", page: "https://app/meetings", browser: "Chrome", viewport: "1400x900" };

describe("checkReport", () => {
  it("accepts a title and a description", () => expect(checkReport(ok, [])).toEqual({}));
  it("asks for the missing fields", () => {
    const e = checkReport({ title: " ", what: "", steps: "" }, []);
    expect(Object.keys(e).sort()).toEqual(["title", "what"]);
  });
  it("limits screenshots by count, type and size", () => {
    const png = { type: "image/png", size: 1000 };
    expect(checkReport(ok, [png, png, png, png]).screenshots).toBeTruthy();
    expect(checkReport(ok, [{ type: "image/svg+xml", size: 10 }]).screenshots).toBeTruthy();
    expect(checkReport(ok, [{ type: "image/png", size: 6 * 1024 * 1024 }]).screenshots).toBeTruthy();
    expect(checkReport(ok, [png, png, png]).screenshots).toBeUndefined();
  });
});

describe("slackReport", () => {
  it("escapes typed text so it cannot become Slack markup or a mention link", () => {
    expect(slackEscape("<!channel> a & b")).toBe("&lt;!channel&gt; a &amp; b");
    const { blocks } = slackReport({ ...ok, what: "<!channel> hi" }, ctx, []);
    expect(JSON.stringify(blocks)).not.toContain("<!channel>");
  });
  it("adds the steps block and a preview + link per screenshot only when present", () => {
    const bare = slackReport(ok, ctx, []).blocks;
    expect(bare).toHaveLength(3);
    const full = slackReport({ ...ok, steps: "1. Open Meetings" }, ctx, ["https://r2/x.jpg"]).blocks as { type: string }[];
    expect(full.map((b) => b.type)).toEqual(["header", "section", "section", "section", "image", "context"]);
  });
});
