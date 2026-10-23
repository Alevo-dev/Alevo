-- ─────────────────────────────────────────────────────────────────────────
-- Dev-only: fake webhook deliveries so Integrations → "Connection health"
-- has something to draw. Paste into the DEV project's SQL editor (or run
-- `psql "$DIRECT_URL" -f supabase/seed-dev-health.sql`). Never run on prod.
--
-- Seeds the last 24 hours for EVERY organization in the database: ~80 rows
-- per org, spread across the hours, across the four logged providers, with
-- about 10% failures — so the hourly line has shape, "Webhooks ok" lands
-- near 90% and "Failed" near 8. Re-running adds another batch on top.
-- Needs migration 0017 (`npx supabase db push`).
-- ─────────────────────────────────────────────────────────────────────────

insert into public.webhook_deliveries (org_id, provider, outcome, created_at)
select
  o.id,
  (array['calcom', 'calendly', 'twilio', 'resend'])[1 + floor(random() * 4)],
  case when random() < 0.9 then 'ok' else 'failed' end,
  now() - random() * interval '24 hours'
from public.organizations o
cross join generate_series(1, 80)
-- Only one workspace? Uncomment and paste its id (the "Open lead form" link on
-- Conversations ends in it):
-- where o.id = '00000000-0000-0000-0000-000000000000'
;

-- What the card will show per org (same query shape as the page's loader):
select
  o.name,
  count(*) filter (where d.outcome = 'ok')      as ok,
  count(*) filter (where d.outcome = 'failed')  as failed,
  round(100.0 * count(*) filter (where d.outcome = 'ok') / count(*), 1) as ok_pct
from public.webhook_deliveries d
join public.organizations o on o.id = d.org_id
where d.created_at > now() - interval '24 hours'
group by o.name
order by o.name;

-- Clean up when done (fake rows are indistinguishable from real ones, so this
-- removes everything in the window — fine on dev):
-- delete from public.webhook_deliveries where created_at > now() - interval '24 hours';
