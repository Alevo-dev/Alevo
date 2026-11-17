-- ─────────────────────────────────────────────────────────────────────────
-- 0051 — What each vendor call costs us, per environment.
--
-- One row per vendor call (AI tokens, embeddings, texts, emails, phone calls). `env` is where the call ran
-- (development / staging / production: dev and staging share this database, so the column is what tells them apart).
-- `cost_usd` is computed when the row is written (the vendor's own figure where it reports one, else a rate
-- estimate). Read only by the admin console. Service path only: RLS on, no policy, no grant. Additive.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.vendor_spend (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  env        text not null check (env in ('development', 'staging', 'production')),
  provider   text not null,            -- anthropic | voyage | twilio | resend | vapi
  kind       text not null,            -- e.g. agent_turn, embedding, sms_out, sms_in, email_out, call
  org_id     uuid,                     -- null for platform-level calls (no FK: spend history outlives an org)
  units      numeric not null default 0, -- tokens, segments, emails or minutes, per kind
  cost_usd   numeric(12, 6) not null default 0,
  estimated  boolean not null default true, -- false when the vendor reported the cost itself
  detail     text                      -- model name, call id, ...
);

create index if not exists vendor_spend_env_created_idx on public.vendor_spend (env, created_at desc);
create index if not exists vendor_spend_org_created_idx on public.vendor_spend (org_id, created_at desc);

alter table public.vendor_spend enable row level security;
-- No policy, no grant: service-path only.
