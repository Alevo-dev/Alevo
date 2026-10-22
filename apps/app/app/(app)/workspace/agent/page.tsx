import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { listOrgSecretKeys, orgProfiles, type BookingProvider } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { ConnectResult } from "./connect-result";
import { AgentForm } from "./agent-ui";
import { BookingForm } from "./booking-ui";
import { VoiceForm } from "./voice-ui";
import type { AgentValues } from "./actions";
import type { BookingTool, BookingValues } from "./booking-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agent" };

const CHOOSABLE: readonly BookingTool[] = ["calcom", "google", "m365", "calendly"];

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar_connected?: string; calendar_error?: string }>;
}) {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to configure the agent.</Notice>;
    }
    throw error;
  }

  const { calendar_connected, calendar_error } = await searchParams;
  const org = await getCurrentOrg();
  const [[row], setKeys] = org
    ? await Promise.all([
        withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)),
        listOrgSecretKeys(org.id),
      ])
    : [[], []];
  const has = (key: string) => setKeys.includes(key);

  const initial: AgentValues = {
    enabled: row?.enabled ?? false,
    timezone: row?.timezone ?? "",
    sendWindowStartHour: row?.sendWindowStartHour ?? 8,
    sendWindowEndHour: row?.sendWindowEndHour ?? 20,
    smsFromNumber: row?.smsFromNumber ?? "",
  };
  const profileReady = Boolean(row?.companyName && row.offering && row.idealCustomer);

  // `manual` is on the enum but isn't something an org can pick here.
  const chosen = row?.bookingTool && (CHOOSABLE as readonly string[]).includes(row.bookingTool) ? (row.bookingTool as BookingTool) : null;
  const booking: BookingValues = {
    enabled: chosen !== null,
    tool: chosen ?? "calcom",
    calcomEventTypeId: row?.calcomEventTypeId != null ? String(row.calcomEventTypeId) : "",
    bookingLengthMin: row?.bookingLengthMin ?? 30,
    bookingHoursStart: row?.bookingHoursStart ?? 9,
    bookingHoursEnd: row?.bookingHoursEnd ?? 17,
  };
  const calendar = {
    provider: (row?.calendarProvider ?? null) as BookingProvider | null,
    accountEmail: row?.calendarAccountEmail ?? null,
  };

  return (
    <div className="space-y-6">
      <ConnectResult connected={calendar_connected} />
      {calendar_error && <Notice tone="danger">Couldn&apos;t connect your calendar: {calendar_error}</Notice>}

      <AgentForm initial={initial} profileReady={profileReady} />
      <BookingForm
        initial={booking}
        calendar={calendar}
        calcomApiKeySet={has("calcom_api_key")}
        calcomWebhookSecretSet={has("calcom_webhook_secret")}
        calendlyLinkSet={Boolean(row?.calendlyUrl)}
      />
      <VoiceForm
        initial={{ enabled: row?.voiceEnabled ?? false, afterHours: row?.voiceAfterHours ?? "voicemail" }}
        phoneNumber={row?.smsFromNumber ?? null}
      />
    </div>
  );
}
