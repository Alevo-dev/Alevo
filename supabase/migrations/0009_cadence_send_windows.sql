-- ─────────────────────────────────────────────────────────────────────────
-- 0009 — conversation cadence: send windows + contact timezone.
--
-- The Qualifier now follows up when a lead goes quiet (Inngest cadence). Nudges
-- are proactive outbound, so they respect a daily send window in the contact's
-- timezone ("don't nudge at 3am"). Immediate replies to a fresh inbound are NOT
-- gated — speed-to-lead means answering whenever the lead writes.
--
--   • org_profiles — the org's send window (local hours) + default timezone.
--   • contacts     — the contact's own timezone (best-effort; from the lead
--                    form's browser tz today), preferred over the org default.
--
-- No RLS changes: columns hang off existing tenant-isolated tables.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column timezone              text,                         -- IANA; null → app default
  add column send_window_start_hour integer not null default 8,  -- local hour nudges may start (inclusive)
  add column send_window_end_hour   integer not null default 20; -- local hour nudges must stop (exclusive)

-- Keep the window sane (0–24, start before end) so the cadence can't lock up.
alter table public.org_profiles
  add constraint org_profiles_send_window_ck
  check (
    send_window_start_hour >= 0 and send_window_start_hour <= 23
    and send_window_end_hour >= 1 and send_window_end_hour <= 24
    and send_window_start_hour < send_window_end_hour
  );

alter table public.contacts
  add column timezone text;  -- IANA; null → fall back to the org default
