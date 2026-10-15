import { eq } from "drizzle-orm";
import { orgProfiles } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { QualifierForm } from "./qualifier-ui";
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
};

export default async function QualifierPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <p className="text-muted-foreground">You need an admin role to configure the Qualifier.</p>
      );
    }
    throw error;
  }

  const org = await getCurrentOrg();
  const [row] = org
    ? await withOrg((tx) =>
        tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1),
      )
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
      }
    : EMPTY;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">Qualifier</h1>
        <p className="mt-1 text-muted-foreground">
          Teach Alevo about your business so it can qualify inbound leads in your voice.
        </p>
      </div>
      <QualifierForm initial={initial} />
    </section>
  );
}
