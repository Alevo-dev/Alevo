import { ForbiddenError, getCurrentOrg, requireRole, UnauthorizedError, withOrg } from "@alevo/auth";
import { toCsv } from "@/lib/clients/csv";
import { clientsForExport, parseFilter } from "@/lib/clients/queries";
import { anonymousLabel, displayName } from "@/lib/format";
import { CHANNEL_LABEL, CONVERSATION_STATUS } from "@/lib/ui/status";

export const dynamic = "force-dynamic";

const HEADER = ["Name", "Company", "Email", "Phone", "Channels", "Latest status", "Fit", "Open conversations", "Timezone", "Consent source", "Last activity"];

/**
 * CSV of the clients the list shows (`?status=` and `?q=` as on the page),
 * newest activity first, capped at 5,000 rows. Any member may export (viewer+);
 * org id explicit on the read (platform admins bypass RLS).
 */
export async function GET(req: Request) {
  try {
    await requireRole("viewer");
  } catch (error) {
    if (error instanceof UnauthorizedError) return new Response("Sign in to export.", { status: 401 });
    if (error instanceof ForbiddenError) return new Response("You can't export clients.", { status: 403 });
    throw error;
  }
  const org = await getCurrentOrg();
  if (!org) return new Response("No active organization.", { status: 400 });

  const sp = new URL(req.url).searchParams;
  const filter = parseFilter(sp.get("status"));
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  const rows = await withOrg((tx) => clientsForExport(tx, org.id, { filter, q }));

  const body = toCsv(
    HEADER,
    rows.map((r) => [
      displayName(r.firstName, r.lastName, r.email ?? r.phone ?? anonymousLabel(r.channels[0]) ?? "Unnamed"),
      r.company,
      r.email,
      r.phone,
      r.channels.map((c) => CHANNEL_LABEL[c]).join("; "),
      r.latestStatus ? CONVERSATION_STATUS[r.latestStatus].label : "",
      r.maxFit,
      r.openCount,
      r.timezone,
      r.consentSource,
      r.lastActivityAt,
    ]),
  );
  return new Response(`﻿${body}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
