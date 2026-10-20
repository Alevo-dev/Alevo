-- ─────────────────────────────────────────────────────────────────────────
-- 0013 — Booking: meetings + per-org Cal.com event type.
--
-- The Qualifier books through a provider adapter (Cal.com first; Google/M365
-- later) and records the result here. Tenant-isolated. `provider_ref` is the
-- provider's booking id (Cal.com uid), unique per org for webhook idempotency.
-- ─────────────────────────────────────────────────────────────────────────

create type public.booking_provider as enum ('calcom', 'google', 'm365', 'manual');
create type public.meeting_status as enum
  ('scheduled', 'rescheduled', 'cancelled', 'completed', 'no_show');

create table public.meetings (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  contact_id      uuid references public.contacts (id) on delete set null,
  provider        public.booking_provider not null,
  provider_ref    text,
  status          public.meeting_status not null default 'scheduled',
  start_at        timestamptz,
  end_at          timestamptz,
  join_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index meetings_org_id_idx on public.meetings (org_id);
create index meetings_conversation_id_idx on public.meetings (conversation_id);
-- Idempotency for provider webhooks keyed on the booking id.
create unique index meetings_provider_ref_unique
  on public.meetings (org_id, provider_ref) where provider_ref is not null;

alter table public.meetings enable row level security;
create policy meetings_tenant on public.meetings for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

grant select, insert, update, delete on public.meetings to authenticated;

-- The Cal.com event type the Qualifier books (per org). The API key + webhook
-- secret live in org_secrets (calcom_api_key / calcom_webhook_secret).
alter table public.org_profiles add column calcom_event_type_id integer;
