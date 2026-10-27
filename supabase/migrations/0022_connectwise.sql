-- ─────────────────────────────────────────────────────────────────────────
-- 0022 — PSA write-back (ConnectWise Manage first).
--
-- Per-org connection settings live on org_profiles (the API keys live in
-- org_secrets as connectwise_public_key / connectwise_private_key; the
-- platform's developer client ID is an env var). `psa_links` remembers which
-- Alevo record became which PSA record, so a replayed write-back never creates
-- a second company, contact, activity or opportunity. Tenant reads (the
-- conversation page shows what was written); writes via the service path.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column connectwise_site       text,   -- API host, e.g. api-na.myconnectwise.net
  add column connectwise_company_id text,   -- the login company id
  add column connectwise_member     text;   -- API member identifier: owns activities + opportunities

create table public.psa_links (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  provider   text not null,                 -- 'connectwise' (HaloPSA later)
  kind       text not null,                 -- company | contact | activity:<reason> | opportunity
  local_id   uuid not null,                 -- contact id (company, contact) or conversation id (the rest)
  remote_id  text not null,                 -- the PSA record id
  created_at timestamptz not null default now()
);
create unique index psa_links_once on public.psa_links (org_id, provider, kind, local_id);
create index psa_links_local_idx on public.psa_links (org_id, local_id);

alter table public.psa_links enable row level security;
create policy psa_links_tenant_read on public.psa_links for select
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

grant select on public.psa_links to authenticated;
