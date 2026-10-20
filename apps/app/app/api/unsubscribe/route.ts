import { addSuppression, revokeConsentForEmail } from "@alevo/db";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

/**
 * Public unsubscribe endpoint. The token (signed, from the List-Unsubscribe
 * header / email footer link) carries the org + email, so no session is needed
 * and nobody can suppress an address they couldn't already email.
 *
 * POST = RFC 8058 one-click (mail clients call this). GET = a person clicking
 * the footer link; returns a tiny confirmation page.
 */
async function suppress(token: string | null): Promise<boolean> {
  if (!token) return false;
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) return false;
  await addSuppression(parsed.orgId, parsed.email, "unsubscribe");
  await revokeConsentForEmail(parsed.orgId, parsed.email);
  return true;
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const ok = await suppress(token).catch(() => false);
  return new Response(ok ? "ok" : "invalid token", { status: ok ? 200 : 400 });
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const ok = await suppress(token).catch(() => false);
  const body = ok
    ? "<h1>You're unsubscribed</h1><p>You won't receive further emails from this conversation.</p>"
    : "<h1>Link expired</h1><p>This unsubscribe link is invalid or has expired.</p>";
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#111">${body}</body>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
