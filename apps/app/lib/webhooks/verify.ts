import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";

/**
 * Verify a svix-signed webhook (plan.md rule 7). Throws on a missing secret,
 * missing headers, or a bad signature. Returns the parsed event plus the svix
 * message id, which the routes use as the idempotency key.
 */
async function verifySvix<T>(req: Request, secretEnv: string): Promise<{ event: T; id: string }> {
  const secret = process.env[secretEnv];
  if (!secret) throw new Error(`${secretEnv} is not set`);

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
  }) as T;

  return { event, id };
}

/** Clerk webhook (svix). */
export const verifyClerkWebhook = (req: Request) => verifySvix<WebhookEvent>(req, "CLERK_WEBHOOK_SIGNING_SECRET");

/** A Resend webhook envelope (svix-signed, like Clerk). */
export type ResendWebhookEvent = { type: string; data: Record<string, unknown> };

/** Resend webhook (svix). */
export const verifyResendWebhook = (req: Request) => verifySvix<ResendWebhookEvent>(req, "RESEND_WEBHOOK_SECRET");
