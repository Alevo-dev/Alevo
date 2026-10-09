import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";

/**
 * Verify a Clerk webhook via its svix signature (plan.md rule 7). Throws on a
 * missing secret, missing headers, or a bad signature. Returns the parsed event
 * plus the svix message id, which we use as the idempotency key.
 */
export async function verifyClerkWebhook(
  req: Request,
): Promise<{ event: WebhookEvent; id: string }> {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) throw new Error("CLERK_WEBHOOK_SIGNING_SECRET is not set");

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    throw new Error("Missing svix headers");
  }

  const payload = await req.text();
  const event = new Webhook(secret).verify(payload, {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  }) as WebhookEvent;

  return { event, id };
}
