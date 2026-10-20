import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { orgProfiles, type BookingProvider } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { ConnectResult } from "./connect-result";
import { AgentForm, CalendarConnection } from "./agent-ui";
import type { AgentValues } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agent" };

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
  const [row] = org
    ? await withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1))
    : [];

  const initial: AgentValues = {
    enabled: row?.enabled ?? false,
    timezone: row?.timezone ?? "",
    sendWindowStartHour: row?.sendWindowStartHour ?? 8,
    sendWindowEndHour: row?.sendWindowEndHour ?? 20,
    smsFromNumber: row?.smsFromNumber ?? "",
    calcomEventTypeId: row?.calcomEventTypeId != null ? String(row.calcomEventTypeId) : "",
    calendlyUrl: row?.calendlyUrl ?? "",
    bookingLengthMin: row?.bookingLengthMin ?? 30,
    bookingHoursStart: row?.bookingHoursStart ?? 9,
    bookingHoursEnd: row?.bookingHoursEnd ?? 17,
  };
  const profileReady = Boolean(row?.companyName && row.offering && row.idealCustomer);

  const calendar = {
    provider: (row?.calendarProvider ?? null) as BookingProvider | null,
    accountEmail: row?.calendarAccountEmail ?? null,
  };

  return (
    <div className="space-y-6">
      <ConnectResult connected={calendar_connected} />
      {calendar_error && <Notice tone="danger">Couldn&apos;t connect your calendar: {calendar_error}</Notice>}

      <AgentForm initial={initial} profileReady={profileReady} />
      <CalendarConnection provider={calendar.provider} accountEmail={calendar.accountEmail} />
    </div>
  );
}
