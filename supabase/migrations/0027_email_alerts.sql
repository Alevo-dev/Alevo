-- ─────────────────────────────────────────────────────────────────────────
-- 0027 — Email alerts for every org notification, not only a failed booking.
--
-- 0026 added a switch for the "booking failed" email. Now every alert that
-- goes to the org's Slack (qualified lead, meeting booked, hand-off, booking
-- failed, lead needs a person, call summaries) is also emailed to the owners
-- and admins, and this one switch (Workspace → Agent → Notifications →
-- "Email the team") turns the emails off. Rename to say so. Default on.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  rename column booking_fail_email to email_alerts;
