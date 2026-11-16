-- ─────────────────────────────────────────────────────────────────────────
-- 0049 — A picture for the chat agent.
--
-- The workspace can show an image at the top of the website chat window instead of the
-- name's first letter, in one of three sizes. The image itself lives in R2
-- (organizations/{orgId}/avatars/chat-<uuid>.webp, resized and compressed in the browser
-- before it is uploaded); the row keeps its key, when it changed (a cache-buster for the
-- public image URL) and the size. Null key = no picture. Additive and idempotent.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.org_profiles
  add column if not exists chat_avatar_key text,
  add column if not exists chat_avatar_size text not null default 'md' check (chat_avatar_size in ('sm', 'md', 'lg')),
  add column if not exists chat_avatar_at timestamptz;
