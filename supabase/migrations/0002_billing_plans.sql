-- ─────────────────────────────────────────────────────────────────────────
-- 0002 — Billing: plans (reference data), subscriptions, usage counters.
--
-- Usage is metered before it is spent (plan.md rule 11): the service path
-- increments usage_counters; tenants read their own counters + subscription.
-- Tier values from plan.md §6 (draft — confirm with owner).
-- ─────────────────────────────────────────────────────────────────────────

create type public.plan_key as enum ('starter', 'growth', 'scale');
create type public.subscription_status as enum
  ('trialing', 'active', 'past_due', 'canceled', 'paused');
create type public.usage_metric as enum
  ('inbound_conversations', 'voice_minutes', 'outbound_dials',
   'sourced_leads', 'prospecting_emails');

-- ── Plans (global reference data) ───────────────────────────────────────────
create table public.plans (
  id                    uuid primary key default gen_random_uuid(),
  key                   public.plan_key not null unique,
  name                  text not null,
  price_cents           integer not null,              -- monthly, USD cents
  inbound_conversations integer not null,
  voice_minutes         integer not null,
  outbound_dials        integer not null,
  sourced_leads         integer not null,
  prospecting_emails    integer not null,
  sending_domains       integer not null,
  mailboxes             integer not null,
  phone_numbers         integer not null,
  psa_integrations      integer not null,
  coaching_included     boolean not null default false,
  is_active             boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── Subscriptions (one current per org) ─────────────────────────────────────
create table public.org_subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null unique references public.organizations (id) on delete cascade,
  plan_id              uuid not null references public.plans (id),
  status               public.subscription_status not null default 'active',
  current_period_start date,
  current_period_end   date,
  cancel_at_period_end boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index org_subscriptions_plan_id_idx on public.org_subscriptions (plan_id);

-- ── Usage counters (one per org, metric, period) ────────────────────────────
create table public.usage_counters (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  metric       public.usage_metric not null,
  period_start date not null,
  period_end   date not null,
  used         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint usage_counters_org_metric_period_unique unique (org_id, metric, period_start)
);
create index usage_counters_org_id_idx on public.usage_counters (org_id);

-- ── Row-level security ──────────────────────────────────────────────────────
-- plans: readable by any authenticated user (tier info is not secret); writes
-- are platform-managed (migrations / service path), so no write grant.
alter table public.plans enable row level security;
create policy plans_readable on public.plans
  for select using (true);
grant select on public.plans to authenticated;

-- org_subscriptions + usage_counters: tenant-isolated reads. Writes happen only
-- via the service path (billing + metering are server-side), so grant select.
alter table public.org_subscriptions enable row level security;
create policy org_subscriptions_tenant_read on public.org_subscriptions
  for select using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));
grant select on public.org_subscriptions to authenticated;

alter table public.usage_counters enable row level security;
create policy usage_counters_tenant_read on public.usage_counters
  for select using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));
grant select on public.usage_counters to authenticated;

-- ── Seed the three tiers ────────────────────────────────────────────────────
-- Idempotent: re-running updates values, so this migration is the source of the
-- current tier definitions. Changing tiers later = a new migration.
insert into public.plans (
  key, name, price_cents, inbound_conversations, voice_minutes, outbound_dials,
  sourced_leads, prospecting_emails, sending_domains, mailboxes, phone_numbers,
  psa_integrations, coaching_included, sort_order
) values
  ('starter', 'Starter', 150000, 500,  1000, 1000, 600,  2000,  2, 4,  1, 1, false, 1),
  ('growth',  'Growth',  300000, 1200, 2500, 3000, 1800, 6000,  4, 10, 3, 1, false, 2),
  ('scale',   'Scale',   500000, 2500, 5000, 7500, 4500, 15000, 8, 20, 5, 2, true,  3)
on conflict (key) do update set
  name                  = excluded.name,
  price_cents           = excluded.price_cents,
  inbound_conversations = excluded.inbound_conversations,
  voice_minutes         = excluded.voice_minutes,
  outbound_dials        = excluded.outbound_dials,
  sourced_leads         = excluded.sourced_leads,
  prospecting_emails    = excluded.prospecting_emails,
  sending_domains       = excluded.sending_domains,
  mailboxes             = excluded.mailboxes,
  phone_numbers         = excluded.phone_numbers,
  psa_integrations      = excluded.psa_integrations,
  coaching_included     = excluded.coaching_included,
  sort_order            = excluded.sort_order,
  updated_at            = now();
