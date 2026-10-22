-- ─────────────────────────────────────────────────────────────────────────
-- 0019 — One explicit booking tool per org.
--
-- Until now the agent picked a booking mode by precedence over whichever
-- fields happened to be filled in (Cal.com → connected calendar → Calendly).
-- Workspace → Agent now has a Booking switch with one chosen tool, and the
-- code books only through that tool. NULL = booking off (the agent hands off).
--
-- Backfilled from the same precedence the code used, so no org loses booking.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column booking_tool booking_provider
    check (booking_tool in ('calcom', 'google', 'm365', 'calendly'));

update public.org_profiles p
set booking_tool = case
  when p.calcom_event_type_id is not null
   and exists (
     select 1 from public.org_secrets s
     where s.org_id = p.org_id and s.key_name = 'calcom_api_key'
   )
    then 'calcom'::booking_provider
  when p.calendar_provider in ('google', 'm365') and p.calendar_id is not null
    then p.calendar_provider
  when p.calendly_url is not null
    then 'calendly'::booking_provider
end;
