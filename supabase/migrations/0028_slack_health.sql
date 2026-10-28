-- ─────────────────────────────────────────────────────────────────────────
-- 0028 — Slack card health.
--
-- A Slack webhook that starts failing (revoked, channel gone, 403) used to
-- keep showing "Connected". The last failed post is kept on the profile so
-- Integrations shows "Needs attention" with Slack's own reason; a successful
-- post, or saving / clearing the webhook, clears it.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column slack_last_error    text,
  add column slack_last_error_at timestamptz;
