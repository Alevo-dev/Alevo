import { and, eq, sql } from "drizzle-orm";
import { emailSuppressions, type SuppressionReason } from "./schema/suppressions";
import { withService } from "./with-tenant";

/** True if this email is suppressed for the org (unsubscribe / bounce / complaint). */
export async function isSuppressed(orgId: string, email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const rows = await withService((tx) =>
    tx
      .select({ id: emailSuppressions.id })
      .from(emailSuppressions)
      .where(and(eq(emailSuppressions.orgId, orgId), sql`lower(${emailSuppressions.email}) = ${e}`))
      .limit(1),
  );
  return rows.length > 0;
}

/** Add an email to the org's suppression list. Idempotent on (org, lower(email)). */
export async function addSuppression(
  orgId: string,
  email: string,
  reason: SuppressionReason,
): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  await withService((tx) =>
    tx.insert(emailSuppressions).values({ orgId, email: e, reason }).onConflictDoNothing(),
  );
}
