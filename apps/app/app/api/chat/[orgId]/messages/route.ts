import { NextResponse } from "next/server";
import { bearerToken, CHAT_CORS, cleanMessage } from "@/lib/chat/rules";
import { listChatMessages, postChatMessage, resolveSession, startChat, touchSession } from "@/lib/chat/service";

export const dynamic = "force-dynamic";

/**
 * The widget's two calls. POST sends a message: without a token it opens a new
 * chat and returns the token the browser keeps; with one it adds to that
 * thread. GET polls the thread since `after`. The token is the only credential
 * (open CORS: the widget lives on the customer's site); rate limits live in the
 * service.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CHAT_CORS });
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...CHAT_CORS, ...extra } });

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let body: { message?: unknown };
  try {
    body = (await req.json()) as { message?: unknown };
  } catch {
    return json({ ok: false, error: "Could not read the message." }, 400);
  }
  const text = cleanMessage(body.message);
  if (!text) return json({ ok: false, error: "Type a message first." }, 400);

  const token = bearerToken(req.headers);
  if (!token) {
    const started = await startChat(orgId, text, { headers: req.headers });
    return started.ok ? json(started) : json({ ok: false, error: started.error }, started.status);
  }
  const session = await resolveSession(orgId, token);
  // An unknown token means the browser holds a stale session: tell it to start over.
  if (!session) return json({ ok: false, error: "Session expired.", restart: true }, 401);
  const posted = await postChatMessage(session, text, { headers: req.headers });
  return posted.ok ? json(posted) : json({ ok: false, error: posted.error }, posted.status);
}

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const token = bearerToken(req.headers);
  if (!token) return json({ ok: false, error: "Missing token." }, 401);
  const session = await resolveSession(orgId, token);
  if (!session) return json({ ok: false, error: "Session expired.", restart: true }, 401);
  const after = new URL(req.url).searchParams.get("after");
  const [thread] = await Promise.all([listChatMessages(session, after), touchSession(session)]);
  return json({ ok: true, ...thread }, 200, { "cache-control": "no-store" });
}
