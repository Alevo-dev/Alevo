import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { listOrgSecretKeys, memberships, orgProfiles, users } from "@alevo/db";
import { getCurrentOrg, getCurrentUser, requireRole, withOrg } from "@alevo/auth";
import { authInterrupt } from "@/lib/auth-interrupts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { InfoStrip } from "@/components/ui/nav-kit";
import type { WebhookProvider } from "@alevo/db";
import { isEmailConfigured } from "@/lib/email/resend";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { BOOKING_TOOL_LABEL, bookingSnapshot, type BookingTool } from "@/lib/booking/connected";
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
import { IntegrationTabs } from "./integration-tabs";
import { ToolSection } from "./tool-section";
import { TeamCalendars, type CalendarMember } from "./team-calendars";
import { displayName } from "@/lib/format";
import { normaliseHex } from "@/lib/colour";
import { EmbedSnippets } from "./embed-snippets";
import { HealthSection } from "./health-section";
import { ServiceKeysForm } from "./integrations-ui";
import { ElsewhereNote, ServiceRow } from "./service-row";
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
  const [{ calendar_connected, calendar_error }, setKeys, [profile], memberRows, me] = await Promise.all([
    searchParams,
    listOrgSecretKeys(org.id),
    withOrg((tx) => tx.select().from(orgProfiles).where(eq(orgProfiles.orgId, org.id)).limit(1)),
    // The workspace's own people (Alevo support staff are not on the team).
    withOrg((tx) =>
      tx
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, role: memberships.role })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.orgId, org.id), eq(memberships.support, false))),
    ),
    getCurrentUser(),
  ]);
  const team: CalendarMember[] = memberRows
    .map((m) => ({ id: m.id, name: displayName(m.firstName, m.lastName, m.email), email: m.email, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
  // The one calendar everyone shares: the booking tool in use, else any connected one.
  const sharedCalendar = (services.find((s) => s.group === "booking" && s.setup?.connected && s.setup.chosen) ?? services.find((s) => s.group === "booking" && s.setup?.connected))?.name ?? null;
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
    <div>
      <ConnectResult connected={calendar_connected} error={calendar_error} />
      <PageHeader title="Integrations" />
      <InfoStrip
        items={[
          { label: "Connected tools", value: <span className="font-mono">{listed.length}</span> },
          { label: "Booking tool", value: booking.tool && booking.tool in BOOKING_TOOL_LABEL ? BOOKING_TOOL_LABEL[booking.tool as BookingTool] : "Not chosen" },
          { label: "Webhooks, 24h", value: <span className="font-mono">{health.successRate === null ? "No data" : `${(health.successRate * 100).toFixed(1)}%`}</span> },
        ]}
      />

      <div className="mt-5 space-y-5">
        {/* Slim: only when something needs doing, one line each. */}
        {attention.length > 0 && (
          <section aria-label="Needs attention" className="flex flex-col gap-1.5 rounded-sm border border-warning/55 bg-warning/[0.07] px-3 py-[9px] text-[13.5px] text-ink">
            {attention.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 border-t border-warning/25 pt-1.5 first:border-t-0 first:pt-0">
                <span>
                  <b>{s.name}:</b> {s.issue}
                </span>
                <Pill tone={s.status.tone === "danger" ? "danger" : "warning"}>{s.status.label}</Pill>
              </div>
            ))}
          </section>
        )}

        <IntegrationTabs
          tabs={[
            ...SERVICE_GROUPS.map((group) => {
              const rows = listed.filter((s) => s.group === group.id);
              const addable = canModify ? connectable.filter((s) => s.group === group.id) : [];
              return {
                key: group.id,
                label: group.title,
                count: rows.length,
                content: (
                  <ToolSection
                    id={group.id}
                    title={group.title}
                    hint={group.hint}
                    add={group.add}
                    pick={group.pick}
                    tools={addable.map((s) => ({
                      id: s.id,
                      name: s.name,
                      icon: s.icon,
                      managed: s.managed,
                      unavailable: s.status.label === "Coming soon" ? "Soon" : s.status.label,
                      dialogDescription: dialogDescription(s),
                    }))}
                    panels={Object.fromEntries(addable.filter((s) => s.managed).map((s) => [s.id, manageContent(s)]))}
                  >
                    {rows.length === 0 ? (
                      <p className="px-3.5 py-3.5 text-ink-muted">Nothing connected yet.</p>
                    ) : (
                      <ul>
                        {rows.map((s) => (
                          <ServiceRow key={s.id} service={s} manage={manageContent(s)} dialogDescription={dialogDescription(s)} />
                        ))}
                      </ul>
                    )}
                    {group.id === "booking" && team.length > 0 && <TeamCalendars calendar={sharedCalendar} me={team.find((m) => m.id === me?.id)} members={team} />}
                  </ToolSection>
                ),
              };
            }),
            { key: "health", label: "Connection health", content: <HealthSection health={health} /> },
          ]}
        />
      </div>
    </div>
  );
}
