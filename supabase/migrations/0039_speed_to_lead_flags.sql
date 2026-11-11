-- 0039 speed-to-lead flags (additive; older code ignores the columns).
--
-- agent_skipped: why the agent could not work this lead (it was off, paused at the plan limit,
--   or the contact is unsubscribed). Speed to lead leaves these out: the wait was not the
--   agent's to answer. Null = the agent was able to work it, so its first reply counts in full.
-- reply_failed_at / reply_error: the agent's latest reply was written but could not be
--   delivered (SMS or email send failed). Cleared when a later reply goes through. The
--   dashboard and the conversation show it so a person can step in.

alter table public.conversations
  add column agent_skipped text check (agent_skipped in ('disabled', 'over-allowance', 'suppressed')),
  add column reply_failed_at timestamptz,
  add column reply_error text;

-- The dashboard counts open failures per org; most orgs have none.
create index conversations_reply_failed_idx on public.conversations (org_id) where reply_failed_at is not null;
