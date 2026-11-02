import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { conversations } from "../schema/conversations";
import { memberships, users } from "../schema/identity";
import { orgInvitations } from "../schema/invitations";
import { kbDocuments } from "../schema/knowledge";
import { orgProfiles } from "../schema/org-profiles";
import { orgSecrets } from "../schema/secrets";
import { withService } from "../with-tenant";
import type { ReadinessFacts } from "./readiness";

const one = { one: sql<number>`1` };

/**
 * Gather the readiness facts for one org in a single service transaction (the
 * dashboard calls this on every render). Every query filters on `orgId` in code
 * — platform admins bypass RLS, so the filter is explicit. Booleans are
 * `limit 1` probes, not counts.
 */
export async function loadReadinessFacts(orgId: string): Promise<ReadinessFacts> {
  return withService(async (tx) => {
    const [[profile], [doc], secrets, owners, [replied], [ownerInvite], [ownerMember]] = await Promise.all([
      tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1),
      tx.select(one).from(kbDocuments).where(and(eq(kbDocuments.orgId, orgId), eq(kbDocuments.status, "ready"))).limit(1),
      tx.select({ keyName: orgSecrets.keyName }).from(orgSecrets).where(eq(orgSecrets.orgId, orgId)),
      tx
        .select({ email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.orgId, orgId), inArray(memberships.role, ["owner", "admin"]), eq(memberships.support, false), isNotNull(users.email))),
      tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(conversations)
        .where(and(eq(conversations.orgId, orgId), isNotNull(conversations.firstReplySentAt))),
      tx
        .select(one)
        .from(orgInvitations)
        .where(and(eq(orgInvitations.orgId, orgId), eq(orgInvitations.role, "owner"), eq(orgInvitations.status, "accepted")))
        .limit(1),
      tx
        .select(one)
        .from(memberships)
        .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner"), eq(memberships.support, false)))
        .limit(1),
    ]);

    const has = (key: string) => secrets.some((s) => s.keyName === key);
    const tool = profile?.bookingTool ?? null;
    const bookingConfigured =
      tool === "calcom"
        ? has("calcom_api_key") && profile?.calcomEventTypeId != null
        : tool === "google" || tool === "m365"
          ? profile?.calendarProvider === tool && Boolean(profile?.calendarId)
          : tool === "calendly"
            ? Boolean(profile?.calendlyUrl)
            : false;

    return {
      ownerAccepted: Boolean(ownerInvite || ownerMember),
      companyName: profile?.companyName ?? null,
      offering: profile?.offering ?? null,
      idealCustomer: profile?.idealCustomer ?? null,
      readyDocs: doc ? 1 : 0,
      bookingTool: tool,
      bookingConfigured,
      bookingDeclined: profile?.bookingDeclined ?? false,
      smsFromNumber: profile?.smsFromNumber ?? null,
      phoneDeclined: profile?.phoneDeclined ?? false,
      slackSaved: has("slack_webhook_url"),
      slackVerified: profile?.slackVerifiedAt != null,
      slackDeclined: profile?.slackDeclined ?? false,
      emailAlerts: profile?.emailAlerts ?? true,
      ownerEmailCount: owners.length,
      agentOn: profile?.enabled ?? false,
      repliedConversations: replied?.n ?? 0,
    };
  });
}
