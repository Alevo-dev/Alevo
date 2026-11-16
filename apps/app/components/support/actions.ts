"use server";

import { getCurrentOrg, getCurrentRole, getCurrentUser } from "@alevo/auth";
import { hitRateLimit } from "@alevo/db";
import { postInternal } from "@/lib/alerts/internal";
import { buildObjectKey } from "@/lib/files/keys";
import { displayName } from "@/lib/format";
import { presignGetUrl, putObject } from "@/lib/r2";
import { checkReport, slackReport, type ReportErrors, type ReportValues } from "@/lib/support/report";

export type SupportState = { ok?: boolean; error?: string; errors?: ReportErrors; values?: ReportValues };

const text = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");
const WEEK = 7 * 24 * 60 * 60;

/**
 * Any signed-in member can report a problem. It goes to Alevo's own Slack (the webhook saved under
 * Admin console → Settings → Internal alerts), never to the workspace's Slack. Screenshots are stored in
 * R2 under the org's support folder and linked from the message. Who and which workspace come from the
 * session, not from the form; the page, browser and window size are context the browser adds.
 */
export async function sendSupportReport(_prev: SupportState, fd: FormData): Promise<SupportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in again to send a report." };

  const values: ReportValues = { title: text(fd, "title"), what: text(fd, "what"), steps: text(fd, "steps") };
  const files = fd.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  const errors = checkReport(values, files.map((f) => ({ type: f.type, size: f.size })));
  if (Object.keys(errors).length > 0) return { errors, values };

  if (!(await hitRateLimit(`support:${user.id}`, 5, 3600))) {
    return { error: "You have sent a few reports already. Give us a little while to catch up, then try again.", values };
  }

  const [org, role] = await Promise.all([getCurrentOrg(), getCurrentRole()]);
  try {
    const urls: string[] = [];
    for (const f of files) {
      const key = buildObjectKey(org?.id ?? "unassigned", "support", f.name || "screenshot.jpg", crypto.randomUUID());
      await putObject(key, await f.arrayBuffer(), f.type);
      urls.push(await presignGetUrl(key, WEEK));
    }
    const result = await postInternal(
      slackReport(
        values,
        {
          who: displayName(user.firstName, user.lastName, user.email),
          email: user.email,
          role,
          workspace: org?.name ?? null,
          workspaceId: org?.id ?? null,
          page: text(fd, "page").slice(0, 300) || "Unknown",
          browser: text(fd, "browser").slice(0, 200) || "Unknown",
          viewport: text(fd, "viewport").slice(0, 30),
        },
        urls,
      ),
    );
    if (!result.ok) return { error: "We could not send your report just now. Please try again in a minute.", values };
    return { ok: true };
  } catch {
    return { error: "We could not send your report just now. Please try again in a minute.", values };
  }
}
