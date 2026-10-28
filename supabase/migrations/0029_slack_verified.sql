-- ─────────────────────────────────────────────────────────────────────────
-- 0029 — Slack webhook "Untested" until a post succeeds.
--
-- A freshly saved webhook showed "Connected" before anything had been sent.
-- Now the card reads "Untested" (with a nudge to Send test) until the first
-- successful post stamps `slack_verified_at`. Webhooks already saved were
-- posting before this change, so they are stamped as verified.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column slack_verified_at timestamptz;

update public.org_profiles p
   set slack_verified_at = now()
 where p.slack_last_error is null
   and exists (select 1 from public.org_secrets s where s.org_id = p.org_id and s.key_name = 'slack_webhook_url');
