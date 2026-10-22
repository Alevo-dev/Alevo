-- ─────────────────────────────────────────────────────────────────────────
-- 0017 — Webhook delivery log.
--
-- One row per inbound webhook we handle from a connected service (Resend,
-- Twilio, Cal.com, Calendly). Feeds the Connection health card on the
-- Integrations page. outcome: 'ok' = acknowledged (including duplicates and
-- events we ignore), 'failed' = rejected or errored. Clerk is not logged here.
-- org_id is nullable: a failure before we can resolve the org is still
-- recorded, just not attributed to any workspace.
--
-- Written via the service path (recordWebhookDelivery); tenant-scoped reads.
-- ─────────────────────────────────────────────────────────────────────────

create table public.webhook_deliveries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations (id) on delete cascade,
  provider    text not null check (provider in ('resend', 'twilio', 'calcom', 'calendly')),
  outcome     text not null check (outcome in ('ok', 'failed')),
  created_at  timestamptz not null default now()
);
create index webhook_deliveries_org_created_idx on public.webhook_deliveries (org_id, created_at desc);

alter table public.webhook_deliveries enable row level security;
-- Tenant-scoped reads (a platform admin reads across orgs). Writes via service.
create policy webhook_deliveries_tenant_read on public.webhook_deliveries
  for select using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));
grant select on public.webhook_deliveries to authenticated;
