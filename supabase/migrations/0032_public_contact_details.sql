-- ─────────────────────────────────────────────────────────────────────────
-- 0032 — Public contact details for the website contact form.
--
-- The hosted / embedded contact form shows the business next to the form:
-- phone, email, opening hours and the postal address (already stored as
-- `business_address`). All optional; a blank one is simply not shown.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column contact_email text,
  add column contact_phone text,
  add column contact_hours text;
