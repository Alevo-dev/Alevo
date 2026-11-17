-- ─────────────────────────────────────────────────────────────────────────
-- 0050 — How a contact wants to be reached.
--
-- The lead form asks "Email or text message" (required, email when left empty). The latest answer is kept on the
-- contact; null = never asked (every contact before this). The agent reads it and replies by text when it is
-- 'text' and there is a number to text. Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.contacts
  add column if not exists contact_preference text check (contact_preference in ('email', 'text'));
