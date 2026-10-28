import "server-only";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { orgProfiles, withService } from "@alevo/db";
import { sendPlatformEmail } from "@/lib/email/resend";
import { emailFromSlack } from "./lead-messages";
import { ownerEmails } from "./owner-emails";
import { notifySlack } from "./slack";

/**
 * One org alert, both ways: the org's Slack channel (Integrations → Slack) and,
 * unless the org turned it off (Workspace → Agent → Notifications → "Email the
 * team"), the same text emailed to the owners and admins. Pass `email` when the
 * email deserves its own subject or a longer body; otherwise the Slack text is
 * the email, first line as the subject. Best-effort, never throws.
 */
export async function notifyOrg(orgId: string, text: string, email?: { subject: string; body: string }): Promise<void> {
  try {
    const [row] = await withService((tx) => tx.select({ on: orgProfiles.emailAlerts }).from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1));
    const mail = email ?? emailFromSlack(text);
    await Promise.all([
      notifySlack(orgId, text),
      row?.on === false
        ? undefined
        : ownerEmails(orgId).then(async (to) => {
            const sent = await sendPlatformEmail({ to, subject: `Alevo — ${mail.subject}`, body: mail.body });
            if (!sent.ok && sent.error !== "email-not-configured") {
              console.error(`[notify] org alert email to ${to.length} owner/admin(s) failed: ${sent.error}`);
              Sentry.captureMessage(`Org alert email failed: ${sent.error}`, "warning");
            }
          }),
    ]);
  } catch (err) {
    Sentry.captureException(err);
  }
}
