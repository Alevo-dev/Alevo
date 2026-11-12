-- ─────────────────────────────────────────────────────────────────────────
-- 0043 — Remember which voice answered the last call.
--
-- With several voices turned on, the next call skips the one just used.
-- Additive.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles add column last_voice text;
