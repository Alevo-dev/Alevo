-- ─────────────────────────────────────────────────────────────────────────
-- 0030 — Support memberships + setup declines.
--
-- A platform admin's membership in a client org is "support": no seat, no
-- alert emails, shown as "Alevo support", not removable by the client.
-- Booking and phone can be declined so the Getting started checklist
-- completes without them.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.memberships
  add column support boolean not null default false;

alter table public.org_profiles
  add column booking_declined boolean not null default false,
  add column phone_declined   boolean not null default false;

update public.memberships m
   set support = true
  from public.users u
 where u.id = m.user_id
   and u.is_platform_admin;
