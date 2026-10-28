-- ─────────────────────────────────────────────────────────────────────────
-- 0026 — Email alert when the agent can't book a qualified lead.
--
-- Slack always gets "Booking failed for a qualified lead"; owners and admins
-- also get it by email unless the org turns that off (Workspace → Agent →
-- Booking → "Email when booking fails"). Default on.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column booking_fail_email boolean not null default true;
