-- ─────────────────────────────────────────────────────────────────────────
-- 0012 — Per-org SMS number (Twilio).
--
-- The org's Twilio "from" number. Outbound SMS sends from it; inbound SMS is
-- routed to the org by matching the `To` number, so it must be queryable and
-- unique across orgs. Additive — no RLS change (org_profiles is tenant-scoped).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles add column sms_from_number text;

create unique index org_profiles_sms_from_number_unique
  on public.org_profiles (sms_from_number) where sms_from_number is not null;
