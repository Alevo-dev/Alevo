-- ─────────────────────────────────────────────────────────────────────────
-- 0003 — Organization invitations.
--
-- Mirrors Clerk org invitations so we can (a) show pending invites and (b)
-- carry the intended APP role (Clerk's 2 roles can't express our 4). On accept,
-- the membership webhook reads the pending invite to set memberships.role.
-- Tenant-isolated reads; writes happen via the service path after an admin
-- server action authorizes with requireRole (plan.md rule 4).
-- ─────────────────────────────────────────────────────────────────────────

create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.org_invitations (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  email               text not null,
  role                public.app_role not null default 'rep',
  status              public.invitation_status not null default 'pending',
  clerk_invitation_id text unique,
  invited_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index org_invitations_org_id_idx on public.org_invitations (org_id);

-- At most one pending invite per email per org (case-insensitive).
create unique index org_invitations_pending_unique
  on public.org_invitations (org_id, lower(email))
  where status = 'pending';

alter table public.org_invitations enable row level security;
create policy org_invitations_tenant_read on public.org_invitations
  for select using (org_id = (select app.current_org_id()) or (select app.is_platform_admin()));
grant select on public.org_invitations to authenticated;
