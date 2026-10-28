-- ─────────────────────────────────────────────────────────────────────────
-- 0025 — Website chat widget (Sprint 7.1).
--
-- An org can put a chat bubble on its site. Visitors talk to the Qualifier
-- over the `chat` channel (already in the enum). The org's switch, greeting and
-- colour live on its profile; each visitor session is a row holding the HASH
-- of the token the browser keeps, which is the only way to read or post on
-- that conversation from the open web. Service path only — no policies.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column chat_enabled  boolean not null default false,
  add column chat_greeting text,
  add column chat_accent   text;

create table public.chat_sessions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  token_hash      text not null unique,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

create index chat_sessions_conversation_id_idx on public.chat_sessions (conversation_id);

alter table public.chat_sessions enable row level security;
-- No policies on purpose: only the service role reads or writes this table.
