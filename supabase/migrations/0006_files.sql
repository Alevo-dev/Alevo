-- ─────────────────────────────────────────────────────────────────────────
-- 0006 — Files (Cloudflare R2 object references).
--
-- Objects live in R2; Postgres holds the key + metadata (plan.md: object keys
-- in Postgres). Rows are created on presign (status 'pending') and marked
-- 'uploaded' once the client confirms. Tenant-isolated reads; writes via the
-- service path (the presign/confirm routes).
-- ─────────────────────────────────────────────────────────────────────────

create table public.files (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  r2_key       text not null unique,
  file_name    text,
  content_type text,
  size_bytes   integer,
  uploaded_by  uuid references public.users (id) on delete set null,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index files_org_id_idx on public.files (org_id);

alter table public.files enable row level security;
create policy files_tenant_read on public.files
  for select using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));
grant select on public.files to authenticated;
