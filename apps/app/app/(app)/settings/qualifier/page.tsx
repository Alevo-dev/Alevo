import { eq } from "drizzle-orm";
import { orgProfiles, type BookingProvider } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { ConnectResult } from "./connect-result";
import { CalendarConnection, QualifierForm } from "./qualifier-ui";
import type { ProfileValues } from "./actions";

export const dynamic = "force-dynamic";

const EMPTY: ProfileValues = {
  companyName: "",
  offering: "",
  idealCustomer: "",
  qualifyingCriteria: "",
  disqualifiers: "",
  tone: "",
  signoff: "",
  enabled: false,
  timezone: "",
  sendWindowStartHour: 8,
  sendWindowEndHour: 20,
  smsFromNumber: "",
  calcomEventTypeId: "",
  calendlyUrl: "",
  bookingLengthMin: 30,
  bookingHoursStart: 9,
  bookingHoursEnd: 17,
};

export default async function QualifierPage({
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

  const initial: ProfileValues = row
    ? {
        companyName: row.companyName ?? "",
        offering: row.offering ?? "",
        idealCustomer: row.idealCustomer ?? "",
        qualifyingCriteria: row.qualifyingCriteria ?? "",
        disqualifiers: row.disqualifiers ?? "",
        tone: row.tone ?? "",
        signoff: row.signoff ?? "",
        enabled: row.enabled,
        timezone: row.timezone ?? "",
        sendWindowStartHour: row.sendWindowStartHour,
        sendWindowEndHour: row.sendWindowEndHour,
        smsFromNumber: row.smsFromNumber ?? "",
        calcomEventTypeId: row.calcomEventTypeId != null ? String(row.calcomEventTypeId) : "",
        calendlyUrl: row.calendlyUrl ?? "",
        bookingLengthMin: row.bookingLengthMin,
        bookingHoursStart: row.bookingHoursStart,
        bookingHoursEnd: row.bookingHoursEnd,
      }
    : EMPTY;

  const calendar = {
    provider: (row?.calendarProvider ?? null) as BookingProvider | null,
    accountEmail: row?.calendarAccountEmail ?? null,
  };

  return (
    <div className="space-y-6">
      <ConnectResult connected={calendar_connected} />
      {calendar_error && <Notice tone="danger">Couldn&apos;t connect your calendar: {calendar_error}</Notice>}

      <CalendarConnection provider={calendar.provider} accountEmail={calendar.accountEmail} />
      <QualifierForm initial={initial} />
    </div>
  );
}
