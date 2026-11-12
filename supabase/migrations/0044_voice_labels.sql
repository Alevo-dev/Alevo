-- ─────────────────────────────────────────────────────────────────────────
-- 0044 — A name for each phone voice.
--
-- {"Elliot": "Max", "Emma": "Sophie"}: the name the agent gives callers when
-- that voice answers. A voice with no entry gives no name. Additive.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles add column voice_labels jsonb not null default '{}'::jsonb;
