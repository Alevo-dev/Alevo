-- ─────────────────────────────────────────────────────────────────────────
-- 0040 — Record which embedding model produced each KB chunk.
--
-- Vectors from different models are not comparable (even at the same
-- dimension), so retrieval only searches chunks made by the current model and
-- a model upgrade is a re-embed of the stored text. Additive. Existing rows
-- were all made by voyage-3.5-lite.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.kb_chunks add column embedding_model text;

update public.kb_chunks set embedding_model = 'voyage-3.5-lite' where embedding is not null;
