import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { webhookEvents, withService } from "@alevo/db";
import { verifyClerkWebhook } from "@/lib/webhooks/verify";
import {
  mirrorInvitation,
  mirrorMembership,
  mirrorOrg,
  mirrorUser,
  removeMembership,
  setInvitationStatus,
  type ClerkInvitationData,
  type ClerkMembershipData,
  type ClerkOrgData,
  type ClerkUserData,
} from "@/lib/webhooks/clerk-mirror";

export async function POST(req: Request) {
  // 1. Verify signature (rule 7). Bad signature → 400, no retry.
  let verified: Awaited<ReturnType<typeof verifyClerkWebhook>>;
  try {
    verified = await verifyClerkWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const { event, id } = verified;

  // 2. Idempotency: first writer wins. A replay (Clerk retries) is a no-op.
  const fresh = await withService((tx) =>
    tx
      .insert(webhookEvents)
      .values({ provider: "clerk", eventId: id, eventType: event.type })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id }),
  );
  if (fresh.length === 0) return new Response("ok (duplicate)", { status: 200 });

  // 3. Apply. On failure, drop the idempotency row so Clerk's retry reprocesses.
  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await mirrorUser(event.data as unknown as ClerkUserData);
        break;
      case "organization.created":
      case "organization.updated":
        await mirrorOrg(event.data as unknown as ClerkOrgData);
        break;
      case "organizationMembership.created":
      case "organizationMembership.updated":
        await mirrorMembership(event.data as unknown as ClerkMembershipData);
        break;
      case "organizationMembership.deleted":
        await removeMembership(event.data as unknown as { id: string });
        break;
      case "organizationInvitation.created":
        await mirrorInvitation(event.data as unknown as ClerkInvitationData);
        break;
      case "organizationInvitation.accepted":
        await setInvitationStatus(
          (event.data as unknown as ClerkInvitationData).id,
          "accepted",
        );
        break;
      case "organizationInvitation.revoked":
        await setInvitationStatus(
          (event.data as unknown as ClerkInvitationData).id,
          "revoked",
        );
        break;
      default:
        break; // unhandled event types are acknowledged, not errored
    }
  } catch (err) {
    Sentry.captureException(err);
    await withService((tx) =>
      tx
        .delete(webhookEvents)
        .where(and(eq(webhookEvents.provider, "clerk"), eq(webhookEvents.eventId, id))),
    );
    return new Response("Processing error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
