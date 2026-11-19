-- ─────────────────────────────────────────────────────────────────────────
-- 0054 — Which AI model wrote each agent reply, and which conversation each AI call was for.
--
-- `messages.model` is the model id behind an agent reply (null for people, contacts, fixed lines and every message
-- before this migration). `vendor_spend.conversation_id` ties an AI call's cost to its conversation (no foreign key:
-- spend history outlives a deleted conversation, as it does an organization). Both are shown to Alevo staff only.
-- Additive; no policy change (the tenant policy on messages already covers the new column).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.messages add column if not exists model text;
alter table public.vendor_spend add column if not exists conversation_id uuid;
create index if not exists vendor_spend_conversation_idx on public.vendor_spend (conversation_id) where conversation_id is not null;
