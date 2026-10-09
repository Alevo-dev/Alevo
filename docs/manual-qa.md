# Alevo — Manual QA Checklist

Hand-test steps per phase. `[x]` = you've confirmed it. "Where to look" points at the
exact screen. Automated coverage (typecheck, lint, isolation test) runs in CI; this is
the human layer on top.

Dashboards used below:
- **App** — `http://localhost:3000`
- **Supabase** — Table Editor + SQL Editor
- **Clerk** — Configure → Webhooks → your endpoint → Message attempts
- **ngrok** — the forwarding terminal (shows each `POST /api/webhooks/clerk`)

---

## Phase 1 — Platform foundation (+ billing tables)

### A. Auth & sessions
- [x] Sign up a new user at `/` → redirected into the app.
- [x] Create an organization (header org switcher).
- [ ] Sign out, then sign back in → lands on `/dashboard`, session persists.
- [ ] While signed out, open `/dashboard` directly → redirected to `/sign-in` (proxy gating).
- [ ] While signed in, open `/` → redirected to `/dashboard`.

### B. Identity mirroring (Clerk → our DB)
_Where to look: Supabase Table Editor + ngrok/Clerk webhook logs._
- [x] `organizations` has a row with your org's **name** and a `clerk_id` starting `org_`.
- [x] `users` has your row (`clerk_id` `user_`, your `email`).
- [ ] `memberships` has a row linking you to the org with **`role = owner`** (owner bootstrap).
- [ ] ngrok terminal shows `POST /api/webhooks/clerk  200` for each event; Clerk → Message attempts show `200`.
- [ ] `webhook_events` has one row per delivered event (idempotency ledger).
- [ ] In Clerk, **Resend** a past webhook message → still `200`, and **no duplicate rows** appear in our tables.
- [ ] Edit your name in Clerk (Account) → `user.updated` fires → your `users` row updates.

### C. Tenancy / RLS
- [ ] `/dashboard` shows **your org's name**, your **email**, and **Platform admin: no**.
- [ ] Cross-tenant: in a different browser/incognito, sign up a 2nd account + create a 2nd org. Each dashboard shows only its own org — never the other's. (This is what the automated isolation test proves; this is the human spot-check.)

### D. Super admin
- [x] In Supabase SQL Editor run:
      `update public.users set is_platform_admin = true where email = '<you>@example.com';`
      Reload `/dashboard` → **Platform admin: yes**.
- [ ] **Regression (was a bug):** while platform admin = true, switch organizations in the
      header → the org **name and id on the dashboard update to the newly-selected org**.
      (Fixed: `getCurrentOrg` now scopes explicitly to the active org instead of relying on RLS.)

### E. Billing (schema + seed — DB-only; no UI yet)
_These have no screens yet; verify in Supabase._
- [ ] `plans` has **3 rows**: starter / growth / scale, with prices 150000 / 300000 / 500000 (cents) and the §6 allowances.
- [ ] `org_subscriptions` and `usage_counters` tables exist (empty for now).
- [ ] (SQL) A normal tenant can read plans but not write them — reads are enforced by RLS; subscription/usage writes happen server-side only. _(Covered by the automated test; no manual action needed.)_

### F. Observability (Sentry)
1. Create a Sentry account → **New project** → platform **Next.js** → copy the **DSN**.
2. Put it in `apps/app/.env.local`: `NEXT_PUBLIC_SENTRY_DSN="https://...ingest.sentry.io/..."`.
3. Restart `pnpm --filter @alevo/app dev` (env change).
4. Visit `http://localhost:3000/api/debug/sentry` → it returns a 500 (expected).
- [ ] Within ~a minute, **Sentry → Issues** shows **"Alevo Sentry test error"**.
_(With no DSN set, the route still 500s but nothing is sent — Sentry is a no-op.)_

---

## Members screen (`/settings/members`)

_Prereqs: `npx supabase db push` to apply migration 0003; in Clerk → Webhooks,
add the events `organizationInvitation.created`, `organizationInvitation.accepted`,
`organizationInvitation.revoked` to your endpoint (membership events already cover
the rest). Restart the dev server._

### Access
- [ ] As owner/admin, header shows a **Members** link → opens `/settings/members`; you're listed as **owner**.
- [ ] As a **rep/viewer** (change your own role in SQL to test), the page shows "You need an admin role to manage members."

### Invite + role-on-invite
- [ ] Invite a teammate (email + role, e.g. **admin**) → "Invitation sent"; they appear under **Pending invitations** with that role.
- [ ] (DB) `org_invitations` has a `pending` row with the chosen role.
- [ ] Accept the invite from another account (incognito) → they join; in **Members** they show the **invited role** (e.g. admin, not the default rep), and the pending invite disappears.
- [ ] (DB) that `org_invitations` row is now `accepted`.

### Manage
- [ ] Change a member's role → **Save** → persists after reload; (Clerk → the member's org role also flips admin/member).
- [ ] **Remove** a member → they disappear from the list and lose access to the org.
- [ ] **Revoke** a pending invitation → it disappears; the invite is revoked in Clerk (they can no longer accept).

### Guards
- [ ] Try to demote or remove the **last owner** → blocked with an error message.
- [ ] A non-owner admin cannot grant/modify the **owner** role (blocked).

---

_Next phase appends its own section here._
