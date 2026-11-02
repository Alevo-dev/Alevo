-- ─────────────────────────────────────────────────────────────────────────
-- 0033 — Brand colour for the website contact form.
--
-- The hosted page, the iframe and the embed script can't see the customer's
-- site, so the colour is set once here (a #rrggbb hex; null = Alevo blue on
-- the hosted page / iframe, the page's text colour in the embed script).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column form_accent text;
