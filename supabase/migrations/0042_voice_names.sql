-- ─────────────────────────────────────────────────────────────────────────
-- 0042 — Several phone voices per org; each call uses one of them at random.
--
-- Replaces the single `voice_name` (0041, which stays in place, unused) with a
-- list. Empty = the default voice. Additive.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles add column voice_names text[] not null default '{}';

update public.org_profiles set voice_names = array[voice_name] where voice_name is not null;
