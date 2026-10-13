# Alevo

Monorepo for **Alevo** — an AI SDR for growth and lead generation across email, forms, calls, and chat.

## Structure

```
apps/
  web/            Marketing site — getalevo.com (Next.js 16, Tailwind v4)
  app/            Product app (tenants) — app.getalevo.com (Next 16, Clerk, Supabase/RLS)
  admin/          Platform super-admin — admin.getalevo.com (Alevo-internal)
packages/
  tokens/         Shared design tokens (colors, fonts, spacing, radius, motion)
  tsconfig/       Shared TypeScript configs
  eslint-config/  Shared ESLint flat config
  db/             Drizzle client + tenant RLS seam (withTenant/withService) + schema
  auth/           Auth module — the only importer of Clerk (withOrg, requireRole, ...)
supabase/         Postgres migrations (single source of truth for schema + RLS)
```

The product app's architecture rules and local-dev setup live in
[`apps/app/CLAUDE.md`](apps/app/CLAUDE.md). The full product plan is
[`plan.md`](plan.md).

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
| alevo-app | `apps/app` | app.getalevo.com |
| alevo-admin | `apps/admin` | admin.getalevo.com |

Vercel auto-detects Next.js + Turborepo. Each app has its own `.env.example`.
`apps/admin` reuses the same Supabase + Clerk as `apps/app` and is gated by
`users.is_platform_admin`; `admin.getalevo.com` must be an allowed origin in
Clerk. Locally it runs on port **3001** (`pnpm --filter @alevo/admin dev`).
