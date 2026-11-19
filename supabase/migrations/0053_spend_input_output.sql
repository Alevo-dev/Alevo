-- ─────────────────────────────────────────────────────────────────────────
-- 0053 — Spend: AI input and output tokens and their cost, separately.
--
-- AI calls are priced differently for what goes in (the prompt, the passages) and what comes out (the reply), so the
-- Spend page needs both. Null on every row written before this migration (and on non-AI vendors): those rows keep
-- only the combined `units` / `cost_usd`. Additive; service path only like the rest of the table.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.vendor_spend
  add column if not exists input_tokens    numeric,
  add column if not exists output_tokens   numeric,
  add column if not exists input_cost_usd  numeric(12, 6),
  add column if not exists output_cost_usd numeric(12, 6);
