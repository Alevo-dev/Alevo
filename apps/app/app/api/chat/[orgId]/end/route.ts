import { NextResponse } from "next/server";
import { bearerToken, CHAT_CORS } from "@/lib/chat/rules";
import { endChat, resolveSession } from "@/lib/chat/service";

export const dynamic = "force-dynamic";

/** The widget's "New conversation" button: close the visitor's current chat. The token is the only credential. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CHAT_CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const token = bearerToken(req.headers);
  const session = token ? await resolveSession(orgId, token) : null;
  // No session: nothing to close, and the widget starts fresh either way.
  if (session) await endChat(session);
  return NextResponse.json({ ok: true }, { headers: CHAT_CORS });
}
