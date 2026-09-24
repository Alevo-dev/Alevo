# Alevo

Monorepo for **Alevo** — an AI SDR for growth and lead generation across email, forms, calls, and chat.

## Structure

```
apps/
  web/          Marketing site — getalevo.com (Next.js 16, Tailwind v4)
                (app.getalevo.com — the product app — will live in apps/app)
packages/
  tokens/       Shared design tokens (colors, fonts, spacing, radius, motion)
```

## Getting started

```bash
pnpm install
pnpm dev            # run all apps (Turborepo)
pnpm dev:web        # just the marketing site
```

Other tasks: `pnpm build`, `pnpm lint`, `pnpm typecheck`.

## Deploying to Vercel

Create **one Vercel project per app**, both pointed at this repo:

| Project | Root Directory | Domain |
| --- | --- | --- |
| alevo-web | `apps/web` | getalevo.com |
| alevo-app | `apps/app` (later) | app.getalevo.com |

Vercel auto-detects Next.js + Turborepo. Env vars for `apps/web`:

- `NEXT_PUBLIC_APP_URL` — product app origin (default `https://app.getalevo.com`)
- `NEXT_PUBLIC_ASSETS_URL` — Cloudflare R2 / CDN image origin (optional)

See `apps/web/.env.example`.
