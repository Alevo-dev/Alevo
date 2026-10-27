-- ─────────────────────────────────────────────────────────────────────────
-- 0020 — Business postal address per org.
--
-- Anti-spam law (CAN-SPAM, CASL) requires the sender's physical postal address
-- in every marketing email. The MSP is the sender of the agent's emails, so the
-- address is theirs, entered under Workspace → Business profile, and printed in
-- the footer of every email the agent sends. Free text; NULL = not entered yet.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column business_address text;
