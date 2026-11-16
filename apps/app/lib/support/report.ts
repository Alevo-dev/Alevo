/**
 * The support report: what a person typed in the top bar's Support dialog, checked, and the Slack message
 * built from it. Pure (no I/O) so it is unit-tested; the server action does the uploads and the post.
 */
export type ReportValues = { title: string; what: string; steps: string };
export type ReportErrors = Partial<Record<"title" | "what" | "steps" | "screenshots", string>>;

export const MAX_SCREENSHOTS = 3;
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const SHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Per-field messages for the form (rule 13); an empty object means the report can be sent. */
export function checkReport(v: ReportValues, shots: { type: string; size: number }[]): ReportErrors {
  const errors: ReportErrors = {};
  if (!v.title.trim()) errors.title = "Tell us what the problem is in a few words.";
  else if (v.title.trim().length > 120) errors.title = "Keep this to 120 characters or fewer.";
  if (!v.what.trim()) errors.what = "Describe what went wrong.";
  else if (v.what.trim().length > 2000) errors.what = "Keep this to 2,000 characters or fewer.";
  if (v.steps.trim().length > 2000) errors.steps = "Keep this to 2,000 characters or fewer.";
  if (shots.length > MAX_SCREENSHOTS) errors.screenshots = `Attach up to ${MAX_SCREENSHOTS} screenshots.`;
  else if (shots.some((s) => !SHOT_TYPES.includes(s.type))) errors.screenshots = "Screenshots must be PNG, JPEG or WebP images.";
  else if (shots.some((s) => s.size > MAX_SCREENSHOT_BYTES)) errors.screenshots = "Each screenshot must be 5MB or smaller.";
  return errors;
}

/** Slack mrkdwn treats & < > as markup: escape them in anything a person typed. */
export const slackEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export type ReportContext = {
  who: string;
  email: string | null;
  role: string | null;
  workspace: string | null;
  workspaceId: string | null;
  page: string;
  browser: string;
  viewport: string;
};

/** The Slack message: a header, who and where, what they wrote, then each screenshot (a link and a preview). */
export function slackReport(v: ReportValues, ctx: ReportContext, shotUrls: string[]) {
  const e = (s: string, n: number) => clip(slackEscape(s.trim()), n);
  const text = `Support report: ${clip(v.title.trim(), 100)}`;
  const blocks: object[] = [
    { type: "header", text: { type: "plain_text", text: clip(text, 150) } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*From*\n${e(ctx.who, 150)}${ctx.email ? `\n${e(ctx.email, 150)}` : ""}${ctx.role ? ` (${e(ctx.role, 20)})` : ""}` },
        { type: "mrkdwn", text: `*Workspace*\n${ctx.workspace ? e(ctx.workspace, 150) : "None"}${ctx.workspaceId ? `\n\`${e(ctx.workspaceId, 60)}\`` : ""}` },
        { type: "mrkdwn", text: `*Page*\n${e(ctx.page, 300)}` },
        { type: "mrkdwn", text: `*Browser*\n${e(ctx.browser, 200)}\n${e(ctx.viewport, 30)}` },
      ],
    },
    { type: "section", text: { type: "mrkdwn", text: `*What happened*\n${e(v.what, 2800)}` } },
  ];
  if (v.steps.trim()) blocks.push({ type: "section", text: { type: "mrkdwn", text: `*How it happened*\n${e(v.steps, 2800)}` } });
  shotUrls.forEach((url, i) => blocks.push({ type: "image", image_url: url, alt_text: `Screenshot ${i + 1}`, title: { type: "plain_text", text: `Screenshot ${i + 1}` } }));
  if (shotUrls.length) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Screenshot links (valid 7 days): ${shotUrls.map((u, i) => `<${u}|${i + 1}>`).join("  ")}` }] });
  }
  return { text, blocks };
}
