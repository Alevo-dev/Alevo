-- ─────────────────────────────────────────────────────────────────────────
-- 0018 — Inbound voice (Sprint 4).
--
-- Vapi answers calls on the org's Twilio number and runs the Qualifier's
-- conversation over voice. This adds the org's voice settings and a `calls`
-- record per call (transcript, summary, recording key, outcome). Written via
-- the service path when a call ends; tenant-scoped reads.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column voice_enabled boolean not null default false,
  -- What happens when a call arrives outside the org's hours.
  add column voice_after_hours text not null default 'voicemail'
    check (voice_after_hours in ('voicemail', 'take_message')),
  -- Vapi ids: the assistant built from this profile, and the imported number.
  add column vapi_assistant_id text,
  add column vapi_phone_number_id text;

create table public.calls (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  contact_id      uuid references public.contacts (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  provider        text not null default 'vapi' check (provider in ('vapi')),
  provider_ref    text not null,
  from_number     text,
  to_number       text,
  ended_reason    text,
  started_at      timestamptz,
  ended_at        timestamptz,
  duration_sec    integer,
  summary         text,
  transcript      text,
  recording_key   text,
  outcome         text check (outcome in ('booked', 'handed_off', 'disqualified', 'escalated', 'voicemail', 'none')),
  created_at      timestamptz not null default now(),
  constraint calls_org_provider_ref_unique unique (org_id, provider_ref)
);
create index calls_org_started_idx on public.calls (org_id, started_at desc);
create index calls_contact_idx on public.calls (contact_id);

alter table public.calls enable row level security;
-- Tenant-scoped reads (a platform admin reads across orgs). Writes via service.
create policy calls_tenant_read on public.calls
  for select using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));
grant select on public.calls to authenticated;
