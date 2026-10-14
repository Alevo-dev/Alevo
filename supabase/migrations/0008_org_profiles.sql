-- ─────────────────────────────────────────────────────────────────────────
-- 0008 — org_profiles: the Qualifier's per-org context.
--
-- One row per org. The AI SDR (the Qualifier) reasons over this to reply, ask
-- qualifying questions, and score fit. Tenant-isolated; edited by admins in
-- Settings → Qualifier, read by the Qualifier via the service path (Inngest).
-- ─────────────────────────────────────────────────────────────────────────

create table public.org_profiles (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null unique references public.organizations (id) on delete cascade,
  company_name         text,
  offering             text,  -- what the MSP sells / does
  ideal_customer       text,  -- ICP: who is a good fit
  qualifying_criteria  text,  -- what to confirm before handing off
  disqualifiers        text,  -- red flags → disqualify
  tone                 text,  -- voice guidance for replies
  signoff              text,  -- how to sign messages
  enabled              boolean not null default false,  -- auto-run the Qualifier
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index org_profiles_org_id_idx on public.org_profiles (org_id);

-- ── Row-level security (tenant isolation) ─────────────────────────────────────
alter table public.org_profiles enable row level security;
create policy org_profiles_tenant on public.org_profiles for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

grant select, insert, update, delete on public.org_profiles to authenticated;
