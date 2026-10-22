import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { listOrgSecretKeys, orgProfiles } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { StatusDot } from "@/components/ui/pill";
import { isEmailConfigured } from "@/lib/email/resend";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { buildServices, type ServiceView } from "@/lib/integrations/services";
import { getConnectionHealth } from "@/lib/integrations/health";
import { keyField } from "@/lib/secrets-registry";
import { CalendlyForm } from "./calendly-form";
import { ConnectionHealthCard, PAIR_CARD_CLASS } from "./connection-health";
import { ServiceKeysForm } from "./integrations-ui";
import { ElsewhereNote, ServiceCard } from "./service-card";
import { ManageDialog } from "./manage-dialog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Integrations" };

export default async function SecretsPage() {
  let userRole: string = "viewer";
  try {
    userRole = await requireRole("viewer");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need to be a member of this organization to view integrations.</Notice>;
    }
    throw error;
  }

  const org = await getCurrentOrg();
  if (!org) {
    return <Notice tone="warning">No organization selected.</Notice>;
  }

  // Explicit org filter: platform admins bypass RLS, so scope in code.
  const [setKeys, [profile], health] = await Promise.all([
    listOrgSecretKeys(org.id),
    withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)),
    getConnectionHealth(org.id),
  ]);
  const canReveal = userRole === "admin" || userRole === "owner";
  const isSet = new Set(setKeys);

  const services = buildServices({
    setKeys: isSet,
    smsFromNumber: profile?.smsFromNumber ?? null,
    smsConfigured: isSmsConfigured(),
    emailConfigured: isEmailConfigured(),
    booking: {
      tool: profile?.bookingTool ?? null,
      calcomEventTypeId: profile?.calcomEventTypeId ?? null,
      calendarProvider: profile?.calendarProvider ?? null,
      calendarId: profile?.calendarId ?? null,
      calendlyUrl: profile?.calendlyUrl ?? null,
    },
  });
  const attention = services.filter((s) => s.issue);

  /** The contents of one service's Manage dialog: its own form, or a pointer elsewhere. */
  function manageContent(service: ServiceView) {
    if (service.id === "calendly") {
      return (
        <CalendlyForm
          link={profile?.calendlyUrl ?? ""}
          signingKeySet={isSet.has("calendly_webhook_secret")}
          canModify={canReveal}
        />
      );
    }
    return (
      <>
        {service.keys.length > 0 && (
          <ServiceKeysForm
            canReveal={canReveal}
            canModify={canReveal}
            fields={service.keys.map((key) => keyField(key, isSet.has(key), key === "slack_webhook_url"))}
          />
        )}
        <ElsewhereNote service={service} />
      </>
    );
  }

  return (
    <div className="space-y-10">
      {/* Side by side on desktop, stacked on mobile. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ConnectionHealthCard health={health} />

        <Card as="section" padding="md" aria-labelledby="needs-attention" className={PAIR_CARD_CLASS}>
          <h2 id="needs-attention" className="text-heading font-semibold text-ink">
            Needs attention
          </h2>
          {attention.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center">
              <p className="max-w-xs text-sm text-ink-muted">Nothing needs attention. Every connected service is set up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {attention.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{s.name}</p>
                    <p className="mt-1 text-label text-ink-muted">{s.issue}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 text-label font-medium text-ink">
                      <StatusDot tone="warning" />
                      Warning
                    </span>
                    {s.managed && (
                      <ManageDialog name={s.name} label="Review">
                        {manageContent(s)}
                      </ManageDialog>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="connected-services" className="space-y-4">
        <div>
          <h2 id="connected-services" className="text-heading font-semibold text-ink">
            Connected services
          </h2>
          <p className="mt-2 text-sm text-ink-muted">Where Alevo books meetings, sends messages and posts alerts.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} manage={manageContent(s)} />
          ))}
        </div>
      </section>
    </div>
  );
}
