-- ─────────────────────────────────────────────────────────────────────────
-- 0011 — Email suppression list (compliance).
--
-- A contact lands here on unsubscribe, hard bounce, or spam complaint. The
-- Qualifier checks it before emailing and never sends to a suppressed address.
-- Tenant-isolated; one row per (org, email).
-- ─────────────────────────────────────────────────────────────────────────

create type public.suppression_reason as enum ('unsubscribe', 'bounce', 'complaint');

create table public.email_suppressions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  email      text not null,
  reason     public.suppression_reason not null,
  created_at timestamptz not null default now()
);
create unique index email_suppressions_org_email_unique
  on public.email_suppressions (org_id, lower(email));
create index email_suppressions_org_id_idx on public.email_suppressions (org_id);

alter table public.email_suppressions enable row level security;
create policy email_suppressions_tenant on public.email_suppressions for all
  using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()))
  with check (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));

grant select, insert, update, delete on public.email_suppressions to authenticated;
