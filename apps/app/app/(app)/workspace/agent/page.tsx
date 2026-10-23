import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { listOrgSecretKeys, orgProfiles } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { bookingSnapshot, connectedBookingTools, isBookingTool } from "@/lib/booking/connected";
import { AgentForm } from "./agent-ui";
import { BookingForm } from "./booking-ui";
import { VoiceForm } from "./voice-ui";
import type { AgentValues } from "./actions";
import type { BookingValues } from "./booking-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to configure the agent.</Notice>;
    }
    throw error;
  }

  const org = await getCurrentOrg();
  const [[row], setKeys] = org
    ? await Promise.all([
        withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)),
        listOrgSecretKeys(org.id),
      ])
    : [[], []];

  const initial: AgentValues = {
    enabled: row?.enabled ?? false,
    timezone: row?.timezone ?? "",
    sendWindowStartHour: row?.sendWindowStartHour ?? 8,
    sendWindowEndHour: row?.sendWindowEndHour ?? 20,
    smsFromNumber: row?.smsFromNumber ?? "",
  };
  const profileReady = Boolean(row?.companyName && row.offering && row.idealCustomer);

  // Booking only offers tools that are connected under Integrations. A saved
  // choice that is no longer connected counts as off (the actions clear it too).
  const connected = connectedBookingTools(bookingSnapshot(row), (k) => setKeys.includes(k));
  const chosen = isBookingTool(row?.bookingTool) && connected.some((c) => c.tool === row?.bookingTool) ? row.bookingTool : null;
  const booking: BookingValues = {
    enabled: chosen !== null,
    tool: chosen ?? connected[0]?.tool ?? null,
    bookingLengthMin: row?.bookingLengthMin ?? 30,
    bookingHoursStart: row?.bookingHoursStart ?? 9,
    bookingHoursEnd: row?.bookingHoursEnd ?? 17,
  };

  return (
    <div className="space-y-6">
      <AgentForm initial={initial} profileReady={profileReady} />
      <BookingForm initial={booking} connected={connected} />
      <VoiceForm
        initial={{ enabled: row?.voiceEnabled ?? false, afterHours: row?.voiceAfterHours ?? "voicemail" }}
        phoneNumber={row?.smsFromNumber ?? null}
      />
    </div>
  );
}
