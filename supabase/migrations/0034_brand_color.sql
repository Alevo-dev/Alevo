-- ─────────────────────────────────────────────────────────────────────────
-- 0034 — The workspace's default brand colour.
--
-- 0033 added org_profiles.form_accent for the website form. The same colour is
-- now the default for the chat bubble too, so it is named for what it is.
-- A #rrggbb hex; null = Alevo blue on the hosted page and chat, the page's
-- own text colour in the embed script. A page can still override it.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  rename column form_accent to brand_color;
