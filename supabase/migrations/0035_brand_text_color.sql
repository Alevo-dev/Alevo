-- ─────────────────────────────────────────────────────────────────────────
-- 0035 — The font colour that goes with the brand colour.
--
-- The text on the brand colour: the chat bubble, header and visitor messages,
-- and the coloured panel and button of the website form. A #rrggbb hex;
-- null = white or navy, chosen automatically from the brand colour.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column brand_text_color text;
