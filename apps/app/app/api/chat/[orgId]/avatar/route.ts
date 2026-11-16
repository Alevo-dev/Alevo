import { eq } from "drizzle-orm";
import { orgProfiles, withService } from "@alevo/db";
import { CHAT_CORS } from "@/lib/chat/rules";
import { vendorFetch } from "@/lib/http/vendor-fetch";
import { presignGetUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * The chat agent's picture, for the widget on a customer's page. The bucket stays private: this reads the object
 * server-side and serves it. The widget asks for `?v=<changed-at>`, so a new picture is a new URL and the old one
 * can be cached for a year.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const notFound = () => new Response(null, { status: 404, headers: CHAT_CORS });
  try {
    const [row] = await withService((tx) =>
      tx.select({ key: orgProfiles.chatAvatarKey }).from(orgProfiles).where(eq(orgProfiles.orgId, orgId)).limit(1),
    );
    if (!row?.key) return notFound();
    const res = await vendorFetch(await presignGetUrl(row.key, 60), { method: "GET" });
    if (!res.ok || !res.body) return notFound();
    return new Response(res.body, {
      headers: {
        ...CHAT_CORS,
        "content-type": "image/webp",
        "x-content-type-options": "nosniff",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return notFound();
  }
}
