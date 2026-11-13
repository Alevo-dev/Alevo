import { and, eq, gte, sql } from "drizzle-orm";
import { CONNECTION_PROVIDERS, webhookDeliveries, type WebhookProvider } from "@alevo/db";
import { withOrg } from "@alevo/auth";

const HOURS = 24;
const HOUR_MS = 3_600_000;

/** What each logged service is called and the colour of its line (distinct, none of them red: red means failed). */
export const PROVIDER_STYLE: Record<WebhookProvider, { name: string; color: string }> = {
  resend: { name: "Resend", color: "#2E9BE6" },
  twilio: { name: "Twilio", color: "#8A5CE8" },
  vapi: { name: "Vapi", color: "#17A582" },
  slack: { name: "Slack", color: "#C98216" },
  calcom: { name: "Cal.com", color: "#E5547C" },
  calendly: { name: "Calendly", color: "#F0743C" },
  google: { name: "Google Calendar", color: "#7DB83A" },
  microsoft: { name: "Microsoft 365", color: "#4F5BD5" },
  connectwise: { name: "ConnectWise", color: "#8C97A8" },
};

export type HealthBucket = { at: number; ok: number; failed: number };

export type ProviderHealth = {
  provider: WebhookProvider;
  name: string;
  color: string;
  /** One per hour, oldest first, ending at the current hour. */
  buckets: HealthBucket[];
  ok: number;
  failed: number;
  total: number;
  /** ok / total over the window, or null when nothing was logged. */
  successRate: number | null;
};

export type ConnectionHealth = {
  /** Services that are connected or logged something in the window, in a stable order. */
  providers: ProviderHealth[];
  ok: number;
  failed: number;
  total: number;
  successRate: number | null;
  /** Window start, for the axis. */
  start: number;
};

export type HealthRow = { hour: number; provider: string; ok: number; failed: number };

const rate = (ok: number, total: number) => (total > 0 ? ok / total : null);

/**
 * Rows of (hour, provider, ok, failed) → one series per service. `connected`
 * services appear even when quiet, so a fresh connection shows up with "No data";
 * a service that logged something appears too. Pure, so it is tested directly.
 */
export function shapeHealth(rows: HealthRow[], connected: readonly WebhookProvider[], now: number): ConnectionHealth {
  const start = Math.floor(now / HOUR_MS) * HOUR_MS - (HOURS - 1) * HOUR_MS;
  const seen = new Set<string>(rows.map((r) => r.provider));
  const providers = CONNECTION_PROVIDERS.filter((p) => connected.includes(p) || seen.has(p)).map((provider): ProviderHealth => {
    const byHour = new Map(rows.filter((r) => r.provider === provider).map((r) => [r.hour, r]));
    const buckets = Array.from({ length: HOURS }, (_, i) => {
      const at = start + i * HOUR_MS;
      const row = byHour.get(at);
      return { at, ok: row?.ok ?? 0, failed: row?.failed ?? 0 };
    });
    const ok = buckets.reduce((s, b) => s + b.ok, 0);
    const failed = buckets.reduce((s, b) => s + b.failed, 0);
    return { provider, ...PROVIDER_STYLE[provider], buckets, ok, failed, total: ok + failed, successRate: rate(ok, ok + failed) };
  });
  const ok = providers.reduce((s, p) => s + p.ok, 0);
  const failed = providers.reduce((s, p) => s + p.failed, 0);
  return { providers, ok, failed, total: ok + failed, successRate: rate(ok, ok + failed), start };
}

/**
 * Webhooks we received and API calls we made for this org over the last 24
 * hours, per service, bucketed by hour. The hour is taken from the epoch, so
 * buckets fall on whole UTC hours whatever the database's time zone. Explicit
 * org filter: platform admins bypass RLS.
 */
export async function getConnectionHealth(orgId: string, connected: readonly WebhookProvider[]): Promise<ConnectionHealth> {
  const now = Date.now();
  const start = Math.floor(now / HOUR_MS) * HOUR_MS - (HOURS - 1) * HOUR_MS;
  const hour = sql<Date>`to_timestamp(floor(extract(epoch from ${webhookDeliveries.createdAt}) / 3600) * 3600)`;

  const rows = await withOrg((tx) =>
    tx
      .select({
        hour,
        provider: webhookDeliveries.provider,
        ok: sql<number>`count(*) filter (where ${webhookDeliveries.outcome} = 'ok')::int`,
        failed: sql<number>`count(*) filter (where ${webhookDeliveries.outcome} = 'failed')::int`,
      })
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.orgId, orgId), gte(webhookDeliveries.createdAt, new Date(start))))
      .groupBy(hour, webhookDeliveries.provider),
  );

  return shapeHealth(rows.map((r) => ({ ...r, hour: new Date(r.hour).getTime() })), connected, now);
}
