import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { listOrgSecretKeys, orgProfiles } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { StatusDot } from "@/components/ui/pill";
import { isEmailConfigured } from "@/lib/email/resend";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { bookingSnapshot } from "@/lib/booking/connected";
import { connectwiseSnapshot } from "@/lib/psa/connectwise-map";
import { buildServices, SERVICE_GROUPS, type ServiceView } from "@/lib/integrations/services";
import { getConnectionHealth } from "@/lib/integrations/health";
import { keyField } from "@/lib/secrets-registry";
import { appUrl } from "@/lib/app-url";
import { CalcomForm } from "./calcom-form";
import { CalendarConnect } from "./calendar-connect";
import { CalendlyForm } from "./calendly-form";
import { ConnectResult } from "./connect-result";
import { ConnectWiseForm } from "./connectwise-form";
import { ConnectTool } from "./connect-tool";
import { EmbedSnippets } from "./embed-snippets";
import { ConnectionHealthCard, PAIR_CARD_CLASS } from "./connection-health";
import { ServiceKeysForm } from "./integrations-ui";
import { ElsewhereNote, ServiceCard } from "./service-card";
import { ManageDialog } from "./manage-dialog";
import { SetupStatus } from "./setup-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Integrations" };

const CALENDAR_DESCRIPTION = "Alevo books on one calendar at a time. Only a refresh token is stored, encrypted.";
const FORM_DESCRIPTION = "Put the form on your website, or point your own form at Alevo. Every submission opens a conversation the agent works.";
const CONNECTWISE_DESCRIPTION =
  "When a lead is handed to a person or books a meeting, Alevo creates or finds the company and contact in Manage, logs an activity, and opens an opportunity on a booking. Keys are stored encrypted.";

export default async function SecretsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar_connected?: string; calendar_error?: string }>;
}) {
  let userRole: string = "viewer";
  try {
    userRole = await requireRole("viewer");
  } catch (error) {
    authInterrupt(error);
  }

  const org = await getCurrentOrg();
  if (!org) {
    return <Notice tone="warning">No organization selected.</Notice>;
  }
  // Plain values for the closures below (TS does not narrow `org` inside them).
  const orgId = org.id;
  const orgName = org.name;

  // Explicit org filter: platform admins bypass RLS, so scope in code.
  const [{ calendar_connected, calendar_error }, setKeys, [profile], health] = await Promise.all([
    searchParams,
    listOrgSecretKeys(org.id),
    withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)),
    getConnectionHealth(org.id),
  ]);
  const canModify = userRole === "admin" || userRole === "owner";
  const isSet = new Set(setKeys);
  const booking = bookingSnapshot(profile);
  const connectwise = connectwiseSnapshot(profile);

  const services = buildServices({
    setKeys: isSet,
    smsFromNumber: profile?.smsFromNumber ?? null,
    smsConfigured: isSmsConfigured(),
    emailConfigured: isEmailConfigured(),
    booking,
    connectwise,
  });
  const attention = services.filter((s) => s.issue);
  const listed = services.filter((s) => s.listed);
  const connectable = services.filter((s) => !s.listed);
  const connectedCalendar =
    booking.calendarProvider === "google" || booking.calendarProvider === "m365"
      ? { provider: booking.calendarProvider, email: booking.calendarAccountEmail }
      : null;

  /** The contents of one service's Manage dialog: its own form, or a pointer elsewhere. */
  function manageContent(service: ServiceView) {
    switch (service.id) {
      case "form":
        return <EmbedSnippets orgId={orgId} origin={appUrl()} company={orgName} />;
      case "calcom":
        return (
          <>
            <SetupStatus service={service} />
            <CalcomForm
              eventTypeId={booking.calcomEventTypeId != null ? String(booking.calcomEventTypeId) : ""}
              apiKeySet={isSet.has("calcom_api_key")}
              webhookSecretSet={isSet.has("calcom_webhook_secret")}
              canModify={canModify}
            />
          </>
        );
      case "google":
      case "m365":
        return (
          <>
            <SetupStatus service={service} />
            <CalendarConnect provider={service.id} connected={connectedCalendar} canModify={canModify} />
          </>
        );
      case "calendly":
        return (
          <>
            <SetupStatus service={service} />
            <CalendlyForm link={booking.calendlyUrl ?? ""} signingKeySet={isSet.has("calendly_webhook_secret")} canModify={canModify} />
          </>
        );
      case "connectwise":
        return (
          <ConnectWiseForm
            site={connectwise.site ?? ""}
            companyId={connectwise.companyId ?? ""}
            member={connectwise.member ?? ""}
            publicKeySet={isSet.has("connectwise_public_key")}
            privateKeySet={isSet.has("connectwise_private_key")}
            connected={service.status.label === "Connected"}
            canModify={canModify}
          />
        );
      default:
        return (
          <>
            {service.keys.length > 0 && (
              <ServiceKeysForm
                canReveal={canModify}
                canModify={canModify}
                fields={service.keys.map((key) => keyField(key, isSet.has(key), key === "slack_webhook_url"))}
              />
            )}
            <ElsewhereNote service={service} />
          </>
        );
    }
  }
  const dialogDescription = (service: ServiceView) =>
    service.id === "google" || service.id === "m365"
      ? CALENDAR_DESCRIPTION
      : service.id === "form"
        ? FORM_DESCRIPTION
        : service.id === "connectwise"
          ? CONNECTWISE_DESCRIPTION
          : undefined;

  return (
    <div className="space-y-10">
      <ConnectResult connected={calendar_connected} />
      {calendar_error && <Notice tone="danger">Couldn&apos;t connect your calendar: {calendar_error}</Notice>}

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
                      <ManageDialog name={s.name} label="Review" description={dialogDescription(s)}>
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

      {/* Only connected (or started) tools get a card; everything else waits in the picker. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold text-ink">Connected tools</h2>
          <p className="mt-2 text-sm text-ink-muted">Where Alevo books meetings, sends messages, posts alerts and writes leads back.</p>
        </div>
        {canModify && (
          <ConnectTool
            groups={SERVICE_GROUPS}
            tools={connectable.map((s) => ({
              id: s.id,
              group: s.group,
              name: s.name,
              hint: s.hint,
              icon: s.icon,
              managed: s.managed,
              unavailable: s.status.label,
              dialogDescription: dialogDescription(s),
            }))}
            panels={Object.fromEntries(connectable.filter((s) => s.managed).map((s) => [s.id, manageContent(s)]))}
          />
        )}
      </div>

      {SERVICE_GROUPS.map((group) => {
        const cards = listed.filter((s) => s.group === group.id);
        return (
          <section key={group.id} aria-labelledby={`services-${group.id}`} className="space-y-4">
            <div>
              <h2 id={`services-${group.id}`} className="text-heading font-semibold text-ink">
                {group.title}
              </h2>
              <p className="mt-2 text-sm text-ink-muted">{group.hint}</p>
            </div>
            {cards.length === 0 ? (
              <p className="rounded-md border border-dashed border-hairline p-4 text-sm text-ink-muted">Nothing connected yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((s) => (
                  <ServiceCard key={s.id} service={s} manage={manageContent(s)} dialogDescription={dialogDescription(s)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
