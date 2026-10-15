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

## Database (Supabase, cloud dev project)

```bash
npx supabase link --project-ref <dev-ref>   # one-time; prompts for DB password
npx supabase db push                        # apply supabase/migrations/* to the cloud DB
```

Env lives in `apps/app/.env.local` (copy from `apps/app/.env.example`). After
your first sign-in, promote yourself to platform admin in the Supabase SQL
editor (see `apps/app/CLAUDE.md` → Platform-admin bootstrap).

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm --filter @alevo/app test
```
