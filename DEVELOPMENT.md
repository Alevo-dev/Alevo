# Local dev runbook

All commands run from the **repo root** unless noted. Package manager is `pnpm`.

## Ports

| App | Package | URL | Notes |
|-----|---------|-----|-------|
| Marketing | `@alevo/web` | http://localhost:3000 | getalevo.com |
| Product app | `@alevo/app` | http://localhost:3001 | app.getalevo.com — Inngest + all webhooks target this |
| Admin | `@alevo/admin` | http://localhost:3002 | |

Ports are pinned in each app's `dev` script, so they never collide.

## Run everything in one shot

```bash
pnpm dev          # all 3 apps (turbo)
pnpm dev:all      # all 3 apps + Inngest dev server
pnpm dev:tunnel   # all 3 apps + Inngest + ngrok tunnel (for inbound webhooks)
```

`dev:all` / `dev:tunnel` use `concurrently`; each process is colour-labelled
(`web`, `app`, `admin`, `inngest`, `ngrok`). `Ctrl-C` once kills the whole group.

## Run one piece

```bash
pnpm dev:web      # marketing  → :3000
pnpm dev:app      # product    → :3001
pnpm dev:admin    # admin      → :3002
pnpm inngest      # Inngest dev server, pointed at the app's /api/inngest (:3001)
pnpm tunnel       # ngrok on the reserved domain → app :3001
```

## Inngest

The dev server auto-discovers the app's functions at
`http://localhost:3001/api/inngest`. It must be running for any fired event
(qualify conversation, cadence nudges, KB ingest) to actually process.
Dashboard: http://localhost:8288.

## ngrok (inbound webhooks: Twilio / Resend / Clerk)

Twilio and Resend need a public URL to reach the app. `pnpm tunnel` opens the
reserved domain **`magical-midge-partly.ngrok-free.app`** → app `:3001`, so the
Twilio/Resend/Clerk dashboard config never needs re-pointing.

```bash
pnpm tunnel   # ngrok http --domain=magical-midge-partly.ngrok-free.app 3001
```

(One-time: `ngrok config add-authtoken <token>`.) Webhook endpoints on the app:

| Provider | Endpoint | Dashboard setting |
|----------|----------|-------------------|
| Twilio   | `/api/webhooks/twilio`  | Phone number → "A message comes in" → POST |
| Resend   | `/api/webhooks/resend`  | "received mail" webhook |
| Clerk    | `/api/webhooks/clerk`   | Webhook endpoint |

So a texted number hits `https://<your-ngrok>/api/webhooks/twilio`. Inspect
traffic at http://127.0.0.1:4040.

## Google Calendar OAuth app (booking calendar connect)

The app code is done (`lib/booking/oauth.ts`, `/api/oauth/google/{start,callback}`);
what it needs is a Google Cloud OAuth client. One Cloud project serves dev and
prod — the client just lists both redirect URIs.

1. **Project:** [console.cloud.google.com](https://console.cloud.google.com) →
   New project (e.g. `alevo`). Enable **Google Calendar API** under
   *APIs & Services → Library*.
2. **Consent screen** (*APIs & Services → OAuth consent screen* / "Google Auth
   Platform → Branding"): user type **External**; app name `Alevo`; support
   email; logo (the mark); home page `https://getalevo.com`; privacy +
   terms URLs on getalevo.com; authorized domain `getalevo.com`.
3. **Scopes** (*Data access*): add
   `https://www.googleapis.com/auth/calendar.events` and
   `https://www.googleapis.com/auth/calendar.freebusy` (plus `openid`, `email`).
   Both are *sensitive* scopes → the project needs **verification** before
   outside users connect without the "unverified app" interstitial. Submit as
   soon as the consent screen is filled in; it takes days to weeks.
4. **Audience / publishing status:** while *Testing*, only listed test users can
   connect **and their refresh tokens expire after 7 days** (bookings would
   silently stop working a week after connecting). Add yourself as a test user
   for the first try, then switch to **In production** (unverified is fine; the
   warning screen has an "Advanced → go to Alevo" link) so tokens persist.
5. **Credentials:** *Credentials → Create credentials → OAuth client ID* →
   **Web application**, name `Alevo app`. Authorized redirect URIs:
   - `https://<your-ngrok>.ngrok-free.app/api/oauth/google/callback` (dev)
   - `https://app.getalevo.com/api/oauth/google/callback` (prod)

   Copy the client ID + secret into `GOOGLE_OAUTH_CLIENT_ID` /
   `GOOGLE_OAUTH_CLIENT_SECRET` (`.env.local` for dev; Vercel → Settings →
   Environment Variables → Production for prod, then redeploy).
6. **Try it:** Workspace → Agent → Booking calendar → Connect Google Calendar.
   The consent screen must show exactly the calendar events + free/busy
   permissions. The checklist is in `docs/manual-qa.md` → "Google Calendar /
   Microsoft 365 booking".

The redirect URI is built from `NEXT_PUBLIC_APP_URL`, so it must match the
registered one character-for-character (scheme, host, no trailing slash).
Google rejects `http://` for anything but localhost — use the ngrok URL in dev.

## Database (Supabase: dev + prod projects)

One migrations folder (`supabase/migrations/`), two targets:

- **Dev** is the *linked* project on your machine. Link once, then push by hand
  whenever you add a migration:

  ```bash
  npx supabase link --project-ref <dev-ref>   # one-time; prompts for the DB password
  pnpm db:push:dev:dry                        # what would run
  pnpm db:push:dev                            # apply to the dev project
  ```

- **Prod** is never pushed from a laptop. The `deploy-db-prod` job in
  `.github/workflows/ci.yml` runs on every push to `main` after build-test
  passes: it links the prod project and runs `supabase db push`. It needs three
  repo secrets — `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_PROJECT_REF`,
  `SUPABASE_PROD_DB_PASSWORD` — and uses the `production` GitHub environment, so
  you can require a manual approval there if you want a gate.

Rules: never edit a migration that has been applied anywhere (add a new one);
`db push` is append-only and records what it applied in each project's
`supabase_migrations.schema_migrations`, so the same file set converges both
projects.

Env lives in `apps/app/.env.local` (copy from `apps/app/.env.example`). After
your first sign-in, promote yourself to platform admin in the Supabase SQL
editor (see `apps/app/CLAUDE.md` → Platform-admin bootstrap).

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm --filter @alevo/app test
```
