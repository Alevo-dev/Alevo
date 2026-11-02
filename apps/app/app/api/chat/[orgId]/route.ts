import { NextResponse } from "next/server";
import { CHAT_CORS } from "@/lib/chat/rules";
import { chatConfig } from "@/lib/chat/service";

export const dynamic = "force-dynamic";

/** What the widget needs before it renders: is chat on, whose chat it is, the greeting and colour. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CHAT_CORS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const config = await chatConfig(orgId);
  if (!config?.enabled) return NextResponse.json({ ok: false }, { status: 404, headers: CHAT_CORS });
  return NextResponse.json(
    { ok: true, company: config.company, agentName: config.agentName, greeting: config.greeting, accent: config.accent, textColor: config.textColor, online: config.online },
    { headers: { ...CHAT_CORS, "cache-control": "public, max-age=60" } },
  );
}
