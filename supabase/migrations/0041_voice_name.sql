-- ─────────────────────────────────────────────────────────────────────────
-- 0041 — The voice the phone agent speaks with.
--
-- One of Vapi's built-in voices, chosen under Workspace → Agent. Null = the
-- default (Savannah). Additive.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles add column voice_name text;
