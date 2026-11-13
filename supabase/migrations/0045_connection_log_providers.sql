-- ─────────────────────────────────────────────────────────────────────────
-- 0045 — Connection health records every service Alevo talks to.
--
-- webhook_deliveries held only inbound webhooks from four providers. It now
-- also holds outbound API calls (Alevo calling a vendor) and covers every
-- vendor an org connects: Vapi, Slack, ConnectWise, Google Calendar and
-- Microsoft 365 as well. `direction` says which way the call went; existing
-- rows are all inbound webhooks. Additive: no row is changed.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.webhook_deliveries
  add column direction text not null default 'inbound' check (direction in ('inbound', 'outbound'));

alter table public.webhook_deliveries drop constraint webhook_deliveries_provider_check;
alter table public.webhook_deliveries
  add constraint webhook_deliveries_provider_check
  check (provider in ('resend', 'twilio', 'calcom', 'calendly', 'vapi', 'slack', 'connectwise', 'google', 'microsoft'));
