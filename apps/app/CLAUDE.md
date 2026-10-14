# Alevo product app (`app.getalevo.com`)

Multi-tenant AI SDR platform. This is the authenticated product app; the
marketing site is `apps/web`. Full product plan: [`/plan.md`](../../plan.md).

> This is Next.js 16 with breaking changes from older versions. Read the guides
> in `node_modules/next/dist/docs/` before writing code. Middleware is now
> `proxy.ts` and is **not** an authorization layer.

## Architecture rules (non-negotiable — from plan.md §3)

1. **Tenancy at the database.** Every tenant table has `org_id` + an RLS policy.
   Every tenant query goes through `withOrg()` (from `@alevo/auth`). A test
   (`tests/tenant-isolation.test.ts`) proves org A cannot read org B.
2. **Own the identity tables.** `organizations`, `users`, `memberships` are
   mirrored from Clerk via the webhook. All FKs/RLS/reporting use OUR uuids,
   never Clerk ids. RLS resolves Clerk claims via `app.current_org_id()`,
   `app.current_user_id()`, `app.current_role()`, `app.is_platform_admin()`,
   each wrapped `(select app.fn())` so it runs once per statement.
3. **One auth module.** `@alevo/auth` is the only importer of `@clerk/nextjs`.
   Exposes `getCurrentUser`, `getCurrentOrg`, `requireRole`,
   `requirePlatformAdmin`, `withOrg`. Nothing else imports Clerk.
4. **App roles in our DB.** enum `app_role ('viewer','rep','admin','owner')`.
   Clerk's two free roles only gate "can manage membership". `requireRole()`
   checks the hierarchy.
7. **Verify every webhook.** Signature-verify (svix for Clerk); handlers are
   idempotent on the provider event id via `webhook_events`.
9. **Heavy AI work runs as Inngest steps** in Next.js functions (not Supabase
   Edge Functions). _(Inngest baseline lands in a later phase.)_
12. **Per-org secrets are encrypted** and never returned to the client.
13. **Errors handled, never defaulted.** Forms use `noValidate` — no native
    browser validation (`required`/`type=` popups) and no `alert()`/`confirm()`.
    Validate in the server action and return **per-field** errors
    (`{ errors: { field } }`) plus a form-level `error` for non-field issues.
    The field with an error gets a **red border** and the message **directly
    beneath it**; form-level errors render once near the submit. Echo submitted
    `values` back so fields keep their input on error. (`useActionState` pattern;
    see the lead / members / secrets forms.)

## Data + auth seams

- **`@alevo/db`** — Drizzle over `postgres-js` through the Supavisor transaction
  pooler (`prepare: false`).
  - `withTenant(claims, fn)` — RLS-enforced: opens a tx, injects
    `request.jwt.claims` with `SET LOCAL`, downgrades to role `authenticated`.
  - `withService(fn)` — RLS **bypass** (connection owner) for webhooks/Inngest.
    No safety net: scope every write by our ids in code. Server-only.
- **`@alevo/auth`** — `withOrg(fn)` wraps `withTenant` with the verified Clerk
  session. Use it for all tenant reads/writes in server components/actions.
- SQL migrations in `/supabase/migrations/` are the **single source of truth**
  (schema + RLS + `app.*` functions + grants). `packages/db/src/schema/*` mirrors
  them for types; regenerate with `pnpm --filter @alevo/db db:pull`.

> **Footgun — platform admins bypass RLS.** Every tenant RLS policy allows
> `app.is_platform_admin()`, so a platform admin reads across ALL orgs. Any query
> that should return the **current org only** MUST filter explicitly
> (`where org_id = (select app.current_org_id())` / resolve via `getCurrentOrg`).
> Never rely on RLS to scope a "current org" read — it's the security backstop,
> not the selector. (Bit us in `getCurrentOrg` and the Members page.)

## Current schema

- **0001** identity + tenancy: `organizations`, `users`, `memberships` (role
  `app_role`), `webhook_events` (idempotency ledger) + the `app.*` RLS helpers.
- **0002** billing: `plans` (3 seeded tiers, readable by any tenant),
  `org_subscriptions`, `usage_counters` (tenant-isolated reads).
- **0003** `org_invitations` (mirrors Clerk invites, carries the app role).
- **0004** `org_secrets` (AES-256-GCM, service-path only — rule 12).
- **0005** `audit_log` (append-only; `recordAudit`; tenant-scoped reads).
- **0006** `files` (R2 object key + metadata; tenant-scoped reads).
- **0007** CRM core: `contacts`, `conversations`, `messages`, `consents` (+ the
  `channel` / `conversation_status` / `message_direction` / `message_author`
  enums). The hosted lead form writes via the service path; tenant users work
  leads via RLS. `recordUsage()` meters inbound conversations (rule 11).
- **0008** `org_profiles` (one row/org): the Qualifier's per-org context (company
  offering, ICP, qualifying criteria, disqualifiers, tone, signoff, `enabled`).
  Edited by admins in Settings → Qualifier; read by the Qualifier via the
  service path.

## The Qualifier (Claude agent)

The AI SDR that works inbound leads. On each inbound message the hosted form /
tester emits `conversation/message.received`; the Inngest function
`qualify-conversation` (rule 9/10, per-org concurrency, `retries: 1`) loads the
org profile + thread and runs the agent.

- **Engine:** `lib/qualifier/` — `prompt.ts` (system prompt from the org
  profile), `tools.ts` (tool defs + DB dispatch), `run.ts` (context loader + a
  **manual** tool-use loop so every tool call is gated/recorded, not the SDK
  auto-runner). Model **`claude-sonnet-5`**, adaptive thinking, effort `medium`.
  Anthropic code lives only here — read the `claude-api` skill before touching it.
- **Tools (MVP):** `reply_to_contact`, `record_fit_score`, `set_status`
  (`active`/`disqualified`/`handed_off`), `escalate_to_human` (→ Slack). Booking
  / PSA tools come with those integrations. All writes go through `withService`,
  scoped to the org **in code** (Inngest has no session → no RLS).
- **Testing before email/SMS exist:** the conversation thread has a "reply as
  contact" box (`[id]/actions.ts` + `reply-ui.tsx`) that posts an inbound message
  and fires the event, so the full loop is exercisable end-to-end.
- **Retry caveat:** the agent writes replies mid-run, so it is intentionally NOT
  wrapped in `step.run` (memoization would replay writes). `retries: 1` bounds
  duplicate-reply risk until idempotency keys land; the Anthropic SDK retries
  transient API errors in-process.

Coming next (Sprint 2): email/SMS channels, Inngest conversation cadences, KB
ingestion (`kb_documents`, `kb_chunks`) for retrieval-grounded replies, and
booking/PSA tools for the Qualifier.

## Durable workflows (Inngest)

- Client in `lib/inngest/client.ts`; functions in `lib/inngest/functions.ts`
  (all registered in the `functions` array); served at `/api/inngest`.
- **Conventions (rule 10):** every function sets a per-tenant concurrency key
  `{ key: "event.data.orgId", … }`; only make something a `step` if it calls a
  vendor or needs independent retry (group pure DB writes); `throttle`
  vendor-calling functions to the vendor's rate limit; heavy AI work runs as
  steps here, never in Supabase Edge Functions.
- Event payloads carry `orgId` (our uuid). Sending an event from a webhook is a
  side-effect — wrap it so a send failure never fails the webhook.
- Local: `npx inngest-cli dev` (auto-discovers `/api/inngest`). Prod: the Vercel
  integration sets `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`.

## Platform-admin bootstrap

There is no UI to grant super-admin. After signing in once (so the Clerk webhook
mirrors your user), promote yourself:

```sql
update public.users set is_platform_admin = true where email = '<you>@example.com';
```

`supabase/seed.sql` does this for the builder on `supabase db reset`.

## Local dev

Dev runs against a **cloud Supabase dev project** (separate from staging/prod) —
Docker is not used (Docker Desktop on Windows Home needs WSL2). Apply migrations
over the network; no local Postgres required.

```bash
npx supabase link --project-ref <dev-ref>   # one-time; prompts for DB password
npx supabase db push                        # apply supabase/migrations/* to the cloud DB
npx inngest-cli dev                          # later phases
pnpm --filter @alevo/app dev                 # app on :3000
```

In `apps/app/.env.local` (copy from `.env.example`):
- `DATABASE_URL` → the project's **Transaction pooler** string (port 6543, `?pgbouncer=true`).
- `DIRECT_URL` → the project's **Session pooler** string (port 5432).
- Clerk keys + `CLERK_WEBHOOK_SIGNING_SECRET`.

`db push` does not run `seed.sql`; run the platform-admin bootstrap manually in
the Supabase SQL editor after your first sign-in. For local Clerk webhooks,
tunnel `:3000` with ngrok and point the Clerk webhook at `/api/webhooks/clerk`.

> Docker alternative (if WSL2 is ever available): `supabase start` + `supabase
> db reset` give the full local stack on `:54322` and run `seed.sql`.

## Observability

Sentry is wired (`instrumentation.ts`, `sentry.*.config.ts`,
`instrumentation-client.ts`) and is a no-op until `NEXT_PUBLIC_SENTRY_DSN` is
set. Source-map upload (withSentryConfig) is intentionally not enabled yet.
