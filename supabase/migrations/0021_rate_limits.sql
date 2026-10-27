-- ─────────────────────────────────────────────────────────────────────────
-- 0021 — Rate limits for public endpoints.
--
-- The lead form is now reachable from the open web (hosted page, embed script,
-- and a JSON endpoint customers' own forms can post to). One row per key
-- (e.g. a hashed IP, or an org) holds a fixed-window counter: `hit` bumps it
-- atomically and tells the caller whether the window's allowance is used up.
-- Service path only — no tenant reads, no policies.
-- ─────────────────────────────────────────────────────────────────────────

create table public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- No policies on purpose: only the service role reads or writes this table.
