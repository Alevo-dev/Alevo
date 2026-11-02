-- ─────────────────────────────────────────────────────────────────────────
-- 0036 — A name for the chat agent.
--
-- Shown at the top of the website chat window instead of the company name
-- (and given to the agent, so it introduces itself the same way).
-- Null = the company name, as before.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column chat_agent_name text;
