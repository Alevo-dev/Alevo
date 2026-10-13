-- ─────────────────────────────────────────────────────────────────────────
-- 0005 — Audit log.
--
-- Append-only record of sensitive actions (role changes, removals, invites,
-- secret changes, super-admin access). Written via the service path; read by
-- the super-admin view and, per-org, by owners/admins. org_id/actor are
-- nullable so platform-level actions and deleted principals still log.
-- ─────────────────────────────────────────────────────────────────────────

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations (id) on delete set null,
  actor_user_id uuid references public.users (id) on delete set null,
  action        text not null,
  target        text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_org_id_idx on public.audit_log (org_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
-- Tenant-scoped reads (a platform admin reads across orgs). Writes via service.
create policy audit_log_tenant_read on public.audit_log
  for select using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));
grant select on public.audit_log to authenticated;
