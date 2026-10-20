-- ─────────────────────────────────────────────────────────────────────────
-- 0015 — Calendly (link mode).
--
-- MSPs that use Calendly share a scheduling link; the Qualifier sends it and the
-- contact books themselves. A meeting is recorded when Calendly's invitee.created
-- webhook fires (link carries utm_content = conversation id). Additive.
-- ─────────────────────────────────────────────────────────────────────────

alter type public.booking_provider add value if not exists 'calendly';

alter table public.org_profiles add column calendly_url text;
