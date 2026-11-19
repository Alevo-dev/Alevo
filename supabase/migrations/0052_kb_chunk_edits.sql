-- ─────────────────────────────────────────────────────────────────────────
-- 0052 — Knowledge chunks can be edited by hand.
--
-- `edited_at` marks a chunk whose text a person changed (and re-embedded). Re-indexing a document replaces every
-- chunk, so the app warns before it throws edited ones away. Additive; the existing RLS policy already covers it.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.kb_chunks add column if not exists edited_at timestamptz;
