-- ─────────────────────────────────────────────────────────────────────────
-- 0031 — Slack can be declined on the setup checklists too.
--
-- "Not using this" on the Slack row of Getting started / Setup, like booking
-- and phone (0030). Cleared again when a Slack webhook is saved.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column slack_declined boolean not null default false;
