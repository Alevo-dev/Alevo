import { NextResponse } from "next/server";
import { captureLead, readLeadFields } from "@/lib/leads/capture";
import { requestOrigin } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/**
 * Public lead endpoint: the embed script and customers' own forms post here.
 * Open CORS (it is a public form; the spam checks and rate limits in
 * `captureLead` are the protection). Accepts JSON, form-encoded or multipart.
 * Replies JSON, except to a plain HTML form post, which is sent to the hosted
 * page's thanks (or its form again with an error flag).
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const type = req.headers.get("content-type") ?? "";
  const wantsHtml = !type.includes("json") && (req.headers.get("accept") ?? "").includes("text/html");

  let body: Record<string, unknown>;
  try {
    if (type.includes("json")) body = (await req.json()) as Record<string, unknown>;
    else body = Object.fromEntries((await req.formData()).entries());
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the submission." }, { status: 400, headers: CORS });
  }

  const source = body.source === "embed" ? "embed" : "api";
  const result = await captureLead(
    orgId,
    readLeadFields((name) => body[name]),
    { source, headers: req.headers },
  );

  if (wantsHtml) {
    const back = new URL(`/f/${orgId}`, requestOrigin(req));
    back.searchParams.set(result.ok ? "submitted" : "error", "1");
    return NextResponse.redirect(back, { status: 303 });
  }
  if (result.ok) return NextResponse.json({ ok: true }, { headers: CORS });
  if (result.status === 400) return NextResponse.json({ ok: false, errors: result.errors }, { status: 400, headers: CORS });
  return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers: CORS });
}
