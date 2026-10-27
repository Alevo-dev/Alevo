-- ─────────────────────────────────────────────────────────────────────────
-- 0023 — Platform-level encrypted settings.
--
-- Alevo's own vendor credentials that are not per tenant (today: the internal
-- alerts Slack webhook the speed-to-lead watch posts to). Same envelope as
-- org_secrets (AES-256-GCM, master key in SECRETS_MASTER_KEY), edited from the
-- admin console instead of env. Service path only: RLS on, no policy, no grant.
-- ─────────────────────────────────────────────────────────────────────────

create table public.platform_secrets (
  key_name    text primary key,
  ciphertext  text not null,
  iv          text not null,
  auth_tag    text not null,
  key_version integer not null default 1,
  updated_at  timestamptz not null default now()
);

alter table public.platform_secrets enable row level security;
-- No policy, no grant: service-path only.
