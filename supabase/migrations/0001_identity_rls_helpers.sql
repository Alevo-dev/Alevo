-- ─────────────────────────────────────────────────────────────────────────
-- 0001 — Identity tables, app roles, and the RLS tenancy core.
--
-- This migration is the single source of truth for the platform's tenancy
-- contract (plan.md rules 1, 2, 4, 7). The Drizzle schema in
-- packages/db/src/schema.ts mirrors these tables for typed queries.
-- ─────────────────────────────────────────────────────────────────────────

create schema if not exists app;

-- App roles live in OUR database, not Clerk (rule 4).
create type public.app_role as enum ('viewer', 'rep', 'admin', 'owner');

-- ── Tables ────────────────────────────────────────────────────────────────
-- Clerk ids are text, never uuid — do not cast them. Our ids are uuid (rule 2).

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  clerk_id   text not null unique,
  name       text not null,
  slug       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id                uuid primary key default gen_random_uuid(),
  clerk_id          text not null unique,
  email             text,
  first_name        text,
  last_name         text,
  image_url         text,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.memberships (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  user_id             uuid not null references public.users (id) on delete cascade,
  role                public.app_role not null default 'rep',
  clerk_membership_id text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint memberships_org_user_unique unique (org_id, user_id)
);
create index memberships_org_id_idx on public.memberships (org_id);
create index memberships_user_id_idx on public.memberships (user_id);

-- Idempotency ledger for inbound webhooks (rule 7). Service-path only.
create table public.webhook_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,
  event_id    text not null,
  event_type  text,
  received_at timestamptz not null default now(),
  constraint webhook_events_provider_event_unique unique (provider, event_id)
);

-- ── RLS helper functions ────────────────────────────────────────────────────
-- security definer so they can resolve Clerk ids -> our uuids by reading the
-- identity tables even though those tables have RLS enabled. Each reads the
-- claims injected transaction-locally by withTenant().

create or replace function app.current_user_id()
returns uuid language sql stable security definer set search_path = public, app as $$
  select u.id
  from public.users u
  where u.clerk_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
$$;

create or replace function app.current_org_id()
returns uuid language sql stable security definer set search_path = public, app as $$
  select o.id
  from public.organizations o
  where o.clerk_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')
$$;

create or replace function app.current_role()
returns public.app_role language sql stable security definer set search_path = public, app as $$
  select m.role
  from public.memberships m
  where m.org_id = (select app.current_org_id())
    and m.user_id = (select app.current_user_id())
$$;

create or replace function app.is_platform_admin()
returns boolean language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (select u.is_platform_admin from public.users u where u.id = (select app.current_user_id())),
    false
  )
$$;

-- ── Row-level security ──────────────────────────────────────────────────────
-- Helpers are wrapped as (select app.fn()) so the planner evaluates them once
-- per statement instead of once per row (rule 2, performance).

alter table public.organizations enable row level security;
create policy organizations_tenant_isolation on public.organizations
  for all
  using (id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (id = (select app.current_org_id()) or (select app.is_platform_admin()));

alter table public.memberships enable row level security;
create policy memberships_tenant_isolation on public.memberships
  for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

alter table public.users enable row level security;
-- A user row is visible to itself, to a platform admin, or to a co-member of
-- the caller's active org.
create policy users_self_or_coworker on public.users
  for all
  using (
    id = (select app.current_user_id())
    or (select app.is_platform_admin())
    or exists (
      select 1
      from public.memberships m
      where m.user_id = public.users.id
        and m.org_id = (select app.current_org_id())
    )
  )
  with check (
    id = (select app.current_user_id())
    or (select app.is_platform_admin())
  );

-- webhook_events: RLS on, no policy = deny all for non-bypass roles. Only the
-- service path (connection owner, BYPASSRLS) ever touches it.
alter table public.webhook_events enable row level security;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- withTenant() downgrades to the `authenticated` role; RLS sits on top of these
-- grants. The service path runs as the owner and bypasses both.

grant usage on schema app to authenticated;
grant execute on function
  app.current_user_id(),
  app.current_org_id(),
  app.current_role(),
  app.is_platform_admin()
to authenticated;

grant select, insert, update, delete on
  public.organizations,
  public.users,
  public.memberships
to authenticated;
-- Note: no grant on public.webhook_events to authenticated (service-only).
