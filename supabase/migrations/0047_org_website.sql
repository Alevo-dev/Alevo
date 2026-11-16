-- ─────────────────────────────────────────────────────────────────────────
-- 0047 — The company website on the profile.
--
-- Workspace → Profile → Company has a Website field (https URL, validated in
-- the app). It is also the default address for "Import from website".
-- NULL = not entered yet.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column website text,
  add constraint org_profiles_website_length check (website is null or char_length(website) <= 200);
