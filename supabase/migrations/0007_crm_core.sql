-- ─────────────────────────────────────────────────────────────────────────
-- 0007 — CRM core: contacts, conversations, messages, consents.
--
-- The lead/conversation spine of the SDR engine. Tenant-isolated; the hosted
-- form writes via the service path (no session), tenant users read/work leads
-- via RLS. Consent is data, not a checkbox (plan.md rule 8).
-- ─────────────────────────────────────────────────────────────────────────

create type public.channel as enum ('form', 'email', 'sms', 'chat', 'voice');
create type public.conversation_status as enum
  ('new', 'active', 'booked', 'disqualified', 'handed_off', 'closed');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_author as enum ('contact', 'assistant', 'human');

-- ── Contacts ────────────────────────────────────────────────────────────────
create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  email      text,
  phone      text,
  first_name text,
  last_name  text,
  company    text,
  source     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_org_id_idx on public.contacts (org_id);
-- Dedupe by email within an org (case-insensitive).
create unique index contacts_org_email_unique
  on public.contacts (org_id, lower(email)) where email is not null;

-- ── Conversations ────────────────────────────────────────────────────────────
create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  contact_id          uuid not null references public.contacts (id) on delete cascade,
  channel             public.channel not null,
  status              public.conversation_status not null default 'new',
  fit_score           integer,
  score_reasons       text,
  assigned_to         uuid references public.users (id) on delete set null,
  lead_received_at    timestamptz not null default now(),
  first_reply_sent_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index conversations_org_id_idx on public.conversations (org_id);
create index conversations_contact_id_idx on public.conversations (contact_id);

-- ── Messages ──────────────────────────────────────────────────────────────────
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction       public.message_direction not null,
  author          public.message_author not null,
  channel         public.channel not null,
  body            text not null,
  provider_ref    text,
  created_at      timestamptz not null default now()
);
create index messages_org_id_idx on public.messages (org_id);
create index messages_conversation_id_idx on public.messages (conversation_id);
-- Idempotency for inbound channel messages keyed on the provider's message id.
create unique index messages_provider_ref_unique
  on public.messages (org_id, provider_ref) where provider_ref is not null;

-- ── Consents ──────────────────────────────────────────────────────────────────
create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel    public.channel not null,
  basis      text not null,
  verbatim   text,
  source     text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index consents_org_id_idx on public.consents (org_id);
create index consents_contact_id_idx on public.consents (contact_id);

-- ── Row-level security (tenant isolation on all four) ─────────────────────────
alter table public.contacts enable row level security;
create policy contacts_tenant on public.contacts for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

alter table public.conversations enable row level security;
create policy conversations_tenant on public.conversations for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

alter table public.messages enable row level security;
create policy messages_tenant on public.messages for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

alter table public.consents enable row level security;
create policy consents_tenant on public.consents for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

grant select, insert, update, delete on
  public.contacts, public.conversations, public.messages, public.consents
to authenticated;
