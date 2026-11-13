import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { listOrgSecretKeys, orgProfiles } from "@alevo/db";
import { getCurrentOrg, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { Notice } from "@/components/ui/notice";
import { StatusDot } from "@/components/ui/pill";
import type { WebhookProvider } from "@alevo/db";
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
import { ChatWidgetForm } from "./chat-widget-form";
import { ConnectResult } from "./connect-result";
import { ConnectWiseForm } from "./connectwise-form";
import { AddTool } from "./add-tool";
import { normaliseHex } from "@/lib/colour";
import { EmbedSnippets } from "./embed-snippets";
import { HealthSection } from "./health-section";
import { ServiceKeysForm } from "./integrations-ui";
import { ElsewhereNote, ServiceRow } from "./service-row";
import { ManageDialog } from "./manage-dialog";
import { SetupStatus } from "./setup-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Integrations" };

const CALENDAR_DESCRIPTION = "Alevo books on one calendar at a time. Only a refresh token is stored, encrypted.";
const FORM_DESCRIPTION = "Put the form on your website, or point your own form at Alevo. Every submission opens a conversation the agent works.";
const CHAT_DESCRIPTION =
  "A chat bubble on your website. Visitors talk to the agent, which answers from your knowledge base, captures their details and books the meeting, like any other channel. The switch at the top right turns the bubble on or off without touching the script on your site.";
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
  const [{ calendar_connected, calendar_error }, setKeys, [profile]] = await Promise.all([
    searchParams,
    listOrgSecretKeys(org.id),
    withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)),
  ]);
  const canModify = userRole === "admin" || userRole === "owner";
  const isSet = new Set(setKeys);
  // The colour each snippet starts with: the Brand colour, else (chat only) the older chat colour, else Alevo blue.
  const brand = normaliseHex(profile?.brandColor ?? "");
  const chatAccent = brand ?? normaliseHex(profile?.chatAccent ?? "") ?? "#2e9be6";
  const embedAccent = brand ?? "#2e9be6";
  const booking = bookingSnapshot(profile);
  const connectwise = connectwiseSnapshot(profile);

  const services = buildServices({
    setKeys: isSet,
    smsFromNumber: profile?.smsFromNumber ?? null,
    smsConfigured: isSmsConfigured(),
    emailConfigured: isEmailConfigured(),
    booking,
    connectwise,
    chat: { enabled: profile?.chatEnabled ?? false },
    slack: { lastError: profile?.slackLastError ?? null, verified: profile?.slackVerifiedAt != null },
  });
  // Every connected tool gets a line in Connection health, even before it has logged anything.
  const LOGGED: Record<string, WebhookProvider> = { calcom: "calcom", calendly: "calendly", google: "google", m365: "microsoft", twilio: "twilio", resend: "resend", slack: "slack", connectwise: "connectwise" };
  const connectedProviders = services.flatMap((s) => (s.listed && LOGGED[s.id] ? [LOGGED[s.id]!] : []));
  if (profile?.vapiAssistantId) connectedProviders.push("vapi");
  const health = await getConnectionHealth(org.id, connectedProviders);
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
        return <EmbedSnippets orgId={orgId} origin={appUrl()} company={orgName} accent={embedAccent} textColor={normaliseHex(profile?.brandTextColor ?? "") ?? ""} />;
      case "chat":
        return (
          <ChatWidgetForm
            enabled={profile?.chatEnabled ?? false}
            greeting={profile?.chatGreeting ?? ""}
            agentName={profile?.chatAgentName ?? ""}
            src={`${appUrl()}/chat.js`}
            orgId={orgId}
            accent={chatAccent}
            textColor={normaliseHex(profile?.brandTextColor ?? "") ?? ""}
            canModify={canModify}
          />
        );
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
        : service.id === "chat"
          ? CHAT_DESCRIPTION
        : service.id === "connectwise"
          ? CONNECTWISE_DESCRIPTION
          : undefined;

  return (
    <div className="space-y-12 lg:w-[70%]">
      <ConnectResult connected={calendar_connected} error={calendar_error} />

      {/* Slim: only when something needs doing, one line each. */}
      {attention.length > 0 && (
        <section aria-label="Needs attention" className="rounded-md border border-warning/50 bg-warning/10 px-4 py-3">
          <ul className="divide-y divide-warning/20">
            {attention.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <p className="min-w-0 flex-1 text-sm text-ink">
                  <span className="font-semibold">{s.name}:</span> {s.issue}
                </p>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-label font-medium text-ink">
                    <StatusDot tone={s.status.tone} />
                    {s.status.label}
                  </span>
                  {s.managed && (
                    <ManageDialog name={s.name} label="Review" description={dialogDescription(s)}>
                      {manageContent(s)}
                    </ManageDialog>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <h2 className="text-title font-semibold text-ink">Connected tools</h2>
        <p className="mt-2 text-sm text-ink-muted">Where Alevo books meetings, sends messages, posts alerts and writes leads back.</p>
      </div>

      {SERVICE_GROUPS.map((group) => {
        const rows = listed.filter((s) => s.group === group.id);
        const addable = connectable.filter((s) => s.group === group.id);
        return (
          <section key={group.id} id={group.id} aria-labelledby={`services-${group.id}`} className="-mt-4 scroll-mt-6">
            {/* The add picker is a sibling of the title row inside this wrapping row, so it opens right under it. */}
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
              <div className="min-w-0 flex-1">
                <h3 id={`services-${group.id}`} className="text-heading font-semibold text-ink">
                  {group.title}
                </h3>
                <p className="mt-1.5 text-sm text-ink-muted">{group.hint}</p>
                <div className="mt-3 h-[3px] w-7 rounded-sm bg-gradient-to-r from-brand to-violet" aria-hidden="true" />
              </div>
              {canModify && addable.length > 0 && (
                <AddTool
                  label={group.add}
                  title={group.pick}
                  tools={addable.map((s) => ({
                    id: s.id,
                    name: s.name,
                    icon: s.icon,
                    managed: s.managed,
                    unavailable: s.status.label,
                    dialogDescription: dialogDescription(s),
                  }))}
                  panels={Object.fromEntries(addable.filter((s) => s.managed).map((s) => [s.id, manageContent(s)]))}
                />
              )}
            </div>
            {rows.length === 0 ? (
              <p className="mt-3 border-y border-hairline px-3 py-5 text-sm text-ink-muted">Nothing connected yet.</p>
            ) : (
              <ul className="mt-3 border-y border-hairline">
                {rows.map((s) => (
                  <ServiceRow key={s.id} service={s} manage={manageContent(s)} dialogDescription={dialogDescription(s)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <HealthSection health={health} />
    </div>
  );
}
