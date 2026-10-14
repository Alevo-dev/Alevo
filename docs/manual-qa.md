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

## Inngest baseline (durable workflows)

_Prereq: in a separate terminal run `npx inngest-cli dev` (it auto-discovers
`http://localhost:3000/api/inngest`). Open the Inngest dev dashboard at
`http://localhost:8288`. The app dev server must also be running._

> Note: `org/provisioned` is **emitted by the app when an org is created** — the
> function reacts to it; it does NOT create anything in Clerk.

- [ ] The Inngest dev dashboard shows the app synced and the **`org-provisioned`** function registered.
- [ ] **Create a new organization** in the app → in the dashboard an **`org/provisioned`** event appears and the function runs to **completion**; in Supabase, `org_subscriptions` gains a **`trialing` Starter** row for that org. (Create a *fresh* org — existing ones were created before this step.)
- [ ] (Manual trigger) In the dashboard "Send event" `org/provisioned` with a **real org uuid**: `{ "data": { "orgId": "<uuid from organizations>" } }` → a run completes and seeds the subscription. A fake id like `"test"` makes the run **fail** (invalid uuid) — which still proves the function executed.
- [ ] Re-sending the same event is idempotent — no duplicate subscription (org_id is unique).
- [ ] Webhook resilience: with the Inngest dev server **stopped**, creating an org still succeeds (the event send is non-fatal) — the org still appears in Supabase.

---

## Encrypted org secrets (`/settings/secrets` → "Integrations")

_Prereq: `npx supabase db push` to apply migration 0004; `SECRETS_MASTER_KEY` set
in `.env.local` (already added); restart the dev server._

### Access
- [ ] Header shows **Integrations**; as admin/owner it opens `/settings/secrets` with the secret registry (Slack webhook, Cal.com key).
- [ ] As a **rep/viewer**, the page shows "You need an admin role to manage integrations."

### Validation
- [ ] **Slack webhook URL** rejects bad input: `not-a-url` → "Enter a valid URL."; an `http://` URL → "must start with https://"; a non-Slack host (e.g. `https://example.com`) → "Must be a Slack webhook URL (hooks.slack.com)." A real `https://hooks.slack.com/services/…` saves.

### Set / replace / clear
- [ ] Enter a value for **Slack webhook URL** → Save → status flips to **Set**; the value is never displayed back.
- [ ] **Replace** it with a new value → still **Set** (no error).
- [ ] **Clear** it → status returns to **Not set**.

### Encryption at rest (the whole point)
- [ ] In Supabase → **`org_secrets`**: after saving, the row's **`ciphertext`** column is gibberish base64 — the plaintext (e.g. the Slack URL) appears **nowhere**. `iv` and `auth_tag` are populated.
- [ ] Saving the **same** value twice (clear, then set again) produces a **different** ciphertext/iv (random per-encryption nonce).
- [ ] The table is service-only: it has no client read path (RLS on, no policy/grant) — only server code decrypts, never the browser.

---

## Slack notifications (per org)

_Prereq: a Slack **incoming webhook** URL saved under Integrations (`slack_webhook_url`)._

- [ ] On `/settings/secrets`, with the Slack webhook **set**, click **Send test** → your Slack channel receives "Test notification from Alevo — <org>", and the page shows "Sent".
- [ ] With the webhook **not set**, the Send test button is disabled.
- [ ] A wrong/revoked webhook → the page shows the Slack error (e.g. "Slack returned 404"), and nothing else breaks.

## Super admin console (admin.getalevo.com — `apps/admin`)

_Prereq: `npx supabase db push` (applies migration 0005). You must be a platform admin
(`users.is_platform_admin = true`). Run the admin app: `pnpm --filter @alevo/admin dev`
(http://localhost:3001). It reuses the same Clerk + Supabase._

- [ ] As a platform admin, sign in at localhost:3001 → the console lists **all** organizations with member count, plan, status, created date.
- [ ] As a signed-in **non-platform-admin**, the console shows "Not authorized."
- [ ] Perform admin actions in the product app (invite/change role/remove, set/clear a secret) → they appear under **Recent activity** here with the right action + target + org.
- [ ] (DB) `audit_log` has a row per action with `actor_user_id` = you.
- [ ] The product app (`app.getalevo.com`) no longer has an Admin link or `/admin` route.

## R2 file uploads

_Prereq: `npx supabase db push` (applies migration 0006); R2 env vars set in `.env.local`
(`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`); the R2 bucket
has a **CORS rule** allowing `PUT` from your app origin (ngrok/localhost). Restart dev._

- [ ] On `/settings/files` (admin), choose a file → it uploads directly to R2; status goes "Requesting…" → "Uploading…" → "Uploaded", and the file appears in the list as **uploaded**.
- [ ] (R2 dashboard) the object exists at key `org/<orgId>/<fileId>/<filename>`.
- [ ] (DB) `files` has a matching row (`status = uploaded`, size, content type).
- [ ] Without R2 env configured, the upload shows a clear "R2 is not configured" error (nothing crashes).
- [ ] As a rep/viewer, `/settings/files` shows "You need an admin role to manage files."

---

# Sprint 2 — SDR engine

## Slice 1: capture + conversation view

_Prereq: `npx supabase db push` (applies migration 0007). Restart the app._

### Hosted lead form (public)
- [ ] In the app → **Conversations**, copy "Your lead form" link (`/f/<orgId>`), open it in an **incognito/logged-out** tab → the form loads with your org's name (no login required).
- [ ] Submit with name + email + message + the consent checkbox → "Thanks — we'll be in touch."
- [ ] Submitting **without** the consent box → error; without name/email → error.
- [ ] A bad org id (`/f/not-a-real-id`) → "This form is not available."

### Conversation shows up
- [ ] Back in the app → **Conversations** → the new lead appears (contact name, channel `form`, status `new`). Click it → the thread shows the inbound message + contact details (email/phone/company).
- [ ] (DB) `contacts`, `conversations`, `messages` (direction `inbound`, author `contact`), and `consents` (basis `form_submission`) rows all exist.
- [ ] Submit the form again with the **same email** → the contact is reused (no duplicate contact), a **new conversation** is created.

### Metering + isolation
- [ ] (DB) `usage_counters` has an `inbound_conversations` row for your org + current month, incrementing by 1 per submission.
- [ ] A different org's user cannot see these conversations (RLS) — the Conversations list is scoped to the active org only.

---

_Next phase appends its own section here._
