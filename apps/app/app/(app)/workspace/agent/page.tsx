import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { listOrgSecretKeys, orgProfiles } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { bookingSnapshot, connectedBookingTools, isBookingTool } from "@/lib/booking/connected";
import { AgentForm } from "./agent-ui";
import { PageHeader } from "@/components/ui/page-header";
import { StatusStrip } from "@/components/workspace/status-strip";
import { getOrgTimezone } from "@/lib/org-timezone";
import { getCurrentUsage } from "@/lib/usage/current";
import { DEFAULT_VOICE, isVoice } from "@/lib/voice/voices";
import type { AgentValues } from "./actions";
import type { BookingValues } from "./booking-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    authInterrupt(error);
  }

  const org = await getCurrentOrg();
  const [tz, usage] = await Promise.all([getOrgTimezone(), getCurrentUsage()]);
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
    emailAlerts: row?.emailAlerts ?? true,
    voiceEnabled: row?.voiceEnabled ?? false,
    voiceAfterHours: row?.voiceAfterHours ?? "voicemail",
    voiceLabels: row?.voiceLabels ?? {},
    voiceNames: row?.voiceNames.some(isVoice) ? row.voiceNames.filter(isVoice) : [DEFAULT_VOICE],
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

  const voice = usage.find((u) => u.metric === "voice_minutes");
  const minutesUsed = voice && voice.allowance > 0 ? `${voice.used} of ${voice.allowance} minutes used` : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Agent" />
      <StatusStrip row={row} tz={tz} />
      <AgentForm
        initial={initial}
        booking={booking}
        connected={connected}
        profileReady={profileReady}
        slackConnected={setKeys.includes("slack_webhook_url")}
        minutesUsed={minutesUsed}
      />
    </div>
  );
}
