-- ─────────────────────────────────────────────────────────────────────────
-- 0004 — Per-org encrypted secrets (plan.md rule 12).
--
-- Stores per-tenant vendor credentials (Slack webhook, Cal.com key, later
-- Twilio/Vapi/ConnectWise) as AES-256-GCM ciphertext. The master key lives in
-- the app env (SECRETS_MASTER_KEY), never in the database, so a DB dump yields
-- only ciphertext. Decryption happens server-side where the secret is used.
--
-- RLS is enabled with NO policy and NO grant to `authenticated`, so the table is
-- reachable ONLY via the service path. The app never returns plaintext (or
-- ciphertext) to the client.
-- ─────────────────────────────────────────────────────────────────────────

create table public.org_secrets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  key_name    text not null,
  ciphertext  text not null,   -- base64
  iv          text not null,   -- base64 (12-byte GCM nonce)
  auth_tag    text not null,   -- base64 (GCM auth tag)
  key_version integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint org_secrets_org_key_unique unique (org_id, key_name)
);
create index org_secrets_org_id_idx on public.org_secrets (org_id);

alter table public.org_secrets enable row level security;
-- No policy, no grant: service-path only.
