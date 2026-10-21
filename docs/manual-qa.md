# Alevo — Manual QA Checklist

Hand-test steps per phase. `[x]` = you've confirmed it. "Where to look" points at the
exact screen. Automated coverage (typecheck, lint, isolation test) runs in CI; this is
the human layer on top.

Dashboards used below:
- **App** — `http://localhost:3001`
- **Supabase** — Table Editor + SQL Editor
- **Clerk** — Configure → Webhooks → your endpoint → Message attempts
- **ngrok** — the forwarding terminal (shows each `POST /api/webhooks/clerk`)

---

## Phase 1 — Platform foundation (+ billing tables)

### A. Auth & sessions
- [x] Sign up a new user at `/` → redirected into the app.
- [x] Create an organization (header org switcher).
- [x] Sign out, then sign back in → lands on `/dashboard`, session persists.
- [x] While signed out, open `/dashboard` directly → redirected to `/sign-in` (proxy gating).
- [x] While signed in, open `/` → redirected to `/dashboard`.

### B. Identity mirroring (Clerk → our DB)
_Where to look: Supabase Table Editor + ngrok/Clerk webhook logs._
- [x] `organizations` has a row with your org's **name** and a `clerk_id` starting `org_`.
- [x] `users` has your row (`clerk_id` `user_`, your `email`).
- [x] `memberships` has a row linking you to the org with **`role = owner`** (owner bootstrap).
- [x] ngrok terminal shows `POST /api/webhooks/clerk  200` for each event; Clerk → Message attempts show `200`.
- [x] `webhook_events` has one row per delivered event (idempotency ledger).
- [x] In Clerk, **Resend** a past webhook message → still `200`, and **no duplicate rows** appear in our tables.
- [x] Edit your name in Clerk (Account) → `user.updated` fires → your `users` row updates.

### C. Tenancy / RLS
- [x] `/dashboard` shows **your org's name**, your **email**, and **Platform admin: no**.
- [x] Cross-tenant: in a different browser/incognito, sign up a 2nd account + create a 2nd org. Each dashboard shows only its own org — never the other's. (This is what the automated isolation test proves; this is the human spot-check.)

### D. Super admin
- [x] In Supabase SQL Editor run:
      `update public.users set is_platform_admin = true where email = '<you>@example.com';`
      Reload `/dashboard` → **Platform admin: yes**.
- [x] **Regression (was a bug):** while platform admin = true, switch organizations in the
      header → the org **name and id on the dashboard update to the newly-selected org**.
      (Fixed: `getCurrentOrg` now scopes explicitly to the active org instead of relying on RLS.)

### E. Billing (schema + seed — DB-only; no UI yet)
_These have no screens yet; verify in Supabase._
- [x] `plans` has **3 rows**: starter / growth / scale, with prices 150000 / 300000 / 500000 (cents) and the §6 allowances.
- [x] `org_subscriptions` and `usage_counters` tables exist (empty for now).
- [x] (SQL) A normal tenant can read plans but not write them — reads are enforced by RLS; subscription/usage writes happen server-side only. _(Covered by the automated test; no manual action needed.)_

### F. Observability (Sentry)
1. Create a Sentry account → **New project** → platform **Next.js** → copy the **DSN**.
2. Put it in `apps/app/.env.local`: `NEXT_PUBLIC_SENTRY_DSN="https://...ingest.sentry.io/..."`.
3. Restart `pnpm --filter @alevo/app dev` (env change).
4. Visit `http://localhost:3001/api/debug/sentry` → it returns a 500 (expected).
- [x] Within ~a minute, **Sentry → Issues** shows **"Alevo Sentry test error"**.
_(With no DSN set, the route still 500s but nothing is sent — Sentry is a no-op.)_

---

## Members screen (`/workspace/members`)

_Prereqs: `npx supabase db push` to apply migration 0003; in Clerk → Webhooks,
add the events `organizationInvitation.created`, `organizationInvitation.accepted`,
`organizationInvitation.revoked` to your endpoint (membership events already cover
the rest). Restart the dev server._

### Access
- [x] As owner/admin, header shows a **Members** link → opens `/workspace/members`; you're listed as **owner**.
- [x] As a **rep/viewer** (change your own role in SQL to test), the page shows "You need an admin role to manage members."

### Invite + role-on-invite
- [x] Invite a teammate (email + role, e.g. **admin**) → "Invitation sent"; they appear under **Pending invitations** with that role.
- [x] (DB) `org_invitations` has a `pending` row with the chosen role.
- [x] Accept the invite from another account (incognito) → they join; in **Members** they show the **invited role** (e.g. admin, not the default rep), and the pending invite disappears.
- [x] (DB) that `org_invitations` row is now `accepted`.

### Manage
- [x] Change a member's role → **Save** → persists after reload; (Clerk → the member's org role also flips admin/member).
- [x] **Remove** a member → they disappear from the list and lose access to the org.
- [x] **Revoke** a pending invitation → it disappears; the invite is revoked in Clerk (they can no longer accept).

### Guards
- [x] Try to demote or remove the **last owner** → blocked with an error message.
- [x] A non-owner admin cannot grant/modify the **owner** role (blocked).

---

## Inngest baseline (durable workflows)

_Prereq: in a separate terminal run `npx inngest-cli dev` (it auto-discovers
`http://localhost:3001/api/inngest`). Open the Inngest dev dashboard at
`http://localhost:8288`. The app dev server must also be running._

> Note: `org/provisioned` is **emitted by the app when an org is created** — the
> function reacts to it; it does NOT create anything in Clerk.

- [x] The Inngest dev dashboard shows the app synced and the **`org-provisioned`** function registered.
- [x] **Create a new organization** in the app → in the dashboard an **`org/provisioned`** event appears and the function runs to **completion**; in Supabase, `org_subscriptions` gains a **`trialing` Starter** row for that org. (Create a *fresh* org — existing ones were created before this step.)
- [x] (Manual trigger) In the dashboard "Send event" `org/provisioned` with a **real org uuid**: `{ "data": { "orgId": "<uuid from organizations>" } }` → a run completes and seeds the subscription. A fake id like `"test"` makes the run **fail** (invalid uuid) — which still proves the function executed.
- [x] Re-sending the same event is idempotent — no duplicate subscription (org_id is unique).
- [x] Webhook resilience: with the Inngest dev server **stopped**, creating an org still succeeds (the event send is non-fatal) — the org still appears in Supabase.

---

## Encrypted org secrets (`/workspace/integrations` → "Integrations")

_Prereq: `npx supabase db push` to apply migration 0004; `SECRETS_MASTER_KEY` set
in `.env.local` (already added); restart the dev server._

### Access
- [x] Header shows **Integrations**; as admin/owner it opens `/workspace/integrations` with the secret registry (Slack webhook, Cal.com key).
- [x] As a **rep/viewer**, the page shows "You need an admin role to manage integrations."

### Validation
- [x] **Slack webhook URL** rejects bad input: `not-a-url` → "Enter a valid URL."; an `http://` URL → "must start with https://"; a non-Slack host (e.g. `https://example.com`) → "Must be a Slack webhook URL (hooks.slack.com)." A real `https://hooks.slack.com/services/…` saves.

### Set / replace / clear
- [x] Enter a value for **Slack webhook URL** → Save → status flips to **Set**; the value is never displayed back.
- [x] **Replace** it with a new value → still **Set** (no error).
- [x] **Clear** it → status returns to **Not set**.

### Encryption at rest (the whole point)
- [x] In Supabase → **`org_secrets`**: after saving, the row's **`ciphertext`** column is gibberish base64 — the plaintext (e.g. the Slack URL) appears **nowhere**. `iv` and `auth_tag` are populated.
- [x] Saving the **same** value twice (clear, then set again) produces a **different** ciphertext/iv (random per-encryption nonce).
- [x] The table is service-only: it has no client read path (RLS on, no policy/grant) — only server code decrypts, never the browser.

---

## Slack notifications (per org)

_Prereq: a Slack **incoming webhook** URL saved under Integrations (`slack_webhook_url`)._

- [x] On `/workspace/integrations`, with the Slack webhook **set**, click **Send test** → your Slack channel receives "Test notification from Alevo — <org>", and the page shows "Sent".
- [x] With the webhook **not set**, the Send test button is disabled.
- [x] A wrong/revoked webhook → the page shows the Slack error (e.g. "Slack returned 404"), and nothing else breaks.

## Super admin console (admin.getalevo.com — `apps/admin`)

_Prereq: `npx supabase db push` (applies migration 0005). You must be a platform admin
(`users.is_platform_admin = true`). Run the admin app: `pnpm --filter @alevo/admin dev`
(http://localhost:3002). It reuses the same Clerk + Supabase._

- [x] As a platform admin, sign in at localhost:3002 → the console lists **all** organizations with member count, plan, status, created date.
- [x] As a signed-in **non-platform-admin**, the console shows "Not authorized."
- [x] Perform admin actions in the product app (invite/change role/remove, set/clear a secret) → they appear under **Recent activity** here with the right action + target + org.
- [x] (DB) `audit_log` has a row per action with `actor_user_id` = you.
- [x] The product app (`app.getalevo.com`) no longer has an Admin link or `/admin` route.

## R2 file uploads

_Prereq: `npx supabase db push` (applies migration 0006); R2 env vars set in `.env.local`
(`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`); the R2 bucket
has a **CORS rule** allowing `PUT` from your app origin (ngrok/localhost). Restart dev._

- [x] On `/workspace/files` (admin), choose a file → it uploads directly to R2; status goes "Requesting…" → "Uploading…" → "Uploaded", and the file appears in the list as **uploaded**.
- [x] (R2 dashboard) the object exists at key `org/<orgId>/<fileId>/<filename>`.
- [x] (DB) `files` has a matching row (`status = uploaded`, size, content type).
- [x] Without R2 env configured, the upload shows a clear "R2 is not configured" error (nothing crashes).
- [x] As a rep/viewer, `/workspace/files` shows "You need an admin role to manage files."

---

# Sprint 2 — SDR engine

## Slice 1: capture + conversation view

_Prereq: `npx supabase db push` (applies migration 0007). Restart the app._

### Hosted lead form (public)
- [x] In the app → **Conversations**, copy "Your lead form" link (`/f/<orgId>`), open it in an **incognito/logged-out** tab → the form loads with your org's name (no login required).
- [x] Submit with name + email + message + the consent checkbox → "Thanks — we'll be in touch."
- [x] Submitting **without** the consent box → error; without name/email → error.
- [x] A bad org id (`/f/not-a-real-id`) → "This form is not available."

### Conversation shows up
- [x] Back in the app → **Conversations** → the new lead appears (contact name, channel `form`, status `new`). Click it → the thread shows the inbound message + contact details (email/phone/company).
- [x] (DB) `contacts`, `conversations`, `messages` (direction `inbound`, author `contact`), and `consents` (basis `form_submission`) rows all exist.
- [x] Submit the form again with the **same email** → the contact is reused (no duplicate contact), a **new conversation** is created.

### Metering + isolation
- [x] (DB) `usage_counters` has an `inbound_conversations` row for your org + current month, incrementing by 1 per submission.
- [x] A different org's user cannot see these conversations (RLS) — the Conversations list is scoped to the active org only.

---

## Slice 4: conversation cadence (follow-up nudges)

_Prereq: `npx supabase db push` (applies migration **0009**). Run the app with
`CADENCE_FAST=1` in `.env.local` so the +1d/+3d/+3d schedule collapses to
~20s/30s/40s, and run `npx inngest-cli dev` (watch its dashboard at
`http://localhost:8288`). The Qualifier must be **enabled** (Settings →
Qualifier) with a contact that has an email, or replies just record in-app._

### Send-window settings (`/workspace/agent`)
- [x] The **Follow-up** section shows a timezone select (default "App default (Eastern)") and Earliest/Latest hour selects (default 08:00 / 20:00).
- [x] Set Earliest **later** than Latest → Save → per-field error "The start time must be before the end time." under the hours; nothing saved.
- [x] Pick a real timezone + a valid window → Save → "Saved."; reload → values persist. (DB) `org_profiles.timezone`, `send_window_start_hour`, `send_window_end_hour` updated; `org_profiles_send_window_ck` would reject a bad window at the DB too.

### Arming + nudging
- [x] Submit the hosted form (or use a conversation's "reply as contact"). The Qualifier replies → in the Inngest dashboard a **`conversation-cadence`** run starts (triggered by `conversation/awaiting-reply`) and is sleeping on `gap-0`.
- [x] Leave the lead quiet. After ~20s the first nudge is sent (a new outbound `assistant` message appears in the thread); then a second and third on the next gaps.
- [x] After the third nudge + gap with no reply, the conversation **status flips to `disqualified`** (Conversations list + DB) — a non-responsive lead is treated as not a fit.

### Reply cancels the cadence
- [x] Arm a cadence (submit → Qualifier replies). While it's sleeping, **reply as the contact**. In the Inngest dashboard the running `conversation-cadence` is **cancelled** (cancelOn `conversation/message.received`), the Qualifier answers the new message, and a **fresh** cadence arms.
- [x] A lead the Qualifier **disqualified** or **handed off** does **not** arm a cadence (no `awaiting-reply`); an already-running cadence stops at its next `check-*` if the status changed.

### Send windows (timezone)
- [x] Set the org window to a range that **excludes now** (e.g. Earliest 00:00 / Latest 01:00 if it's daytime). Arm a cadence → the nudge step `window-wait-*` sleeps until the window opens instead of sending immediately (visible in the Inngest run timeline). Widen the window → nudges send right away.
- [x] (DB) A lead from the hosted form has `contacts.timezone` set (your browser's tz); that tz — not the org default — drives its nudge timing.

### Debounce (speed-to-lead trade-off)
- [x] Fire two inbound messages within a few seconds (double "reply as contact"). Only **one** `qualify-conversation` run executes (debounced per conversation), answering both.

---

## Sprint 3 — Booking + consent + outcomes

Dashboards: **Cal.com** (Bookings), **Calendly** (Scheduled events + Webhooks), **Inngest** dev UI, **App** `/meetings`, **Supabase** (`meetings`, `consents` tables).

### Cal.com booking (API mode)
- [ ] In Workspace → Integrations set a Cal.com **API key** + **webhook secret**; in Workspace → Agent set the numeric **event-type ID**. The Qualifier now offers to book.
- [ ] As a lead, ask for a meeting. The Qualifier calls `check_availability` and offers real open slots; on acceptance it books → you see the booking in **Cal.com** and a new row in **`/meetings`** (status `scheduled`, source `calcom`), and the lead gets a **confirmation message**.
- [ ] The conversation flips to **`booked`** (terminal — Qualifier stops, cadence stops).
- [ ] From `/meetings`, **Reschedule** (pick a new time) and **Cancel** both propagate to Cal.com and update the row; cancel **reopens** the conversation.
- [ ] Cancel/reschedule the booking **in Cal.com directly** → the `/api/webhooks/calcom` sync updates our row (visible in Inngest + the Meetings tab).

### Calendly booking (link mode)
- [ ] Leave the Cal.com event-type **blank**; in Workspace → Agent paste a **Calendly scheduling link** (`https://calendly.com/...`) and set `calendly_webhook_secret` in Integrations. Add a Calendly webhook subscription (invitee.created + invitee.canceled) pointing at `/api/webhooks/calendly`.
- [ ] As a lead, ask to book. The Qualifier sends the **Calendly link** (not slot options) — the URL carries `utm_source=alevo` and `utm_content=<conversationId>`.
- [ ] Book through the Calendly link. Calendly fires `invitee.created` → a new **`/meetings`** row appears (source `calendly`, status `scheduled`) and the conversation flips to **`booked`**. Confirm in Inngest the webhook was signature-verified and processed once (idempotent).
- [ ] On a Calendly row, the Meetings tab shows **outcome + converted controls only** — no Reschedule/Cancel buttons (managed via Calendly's own links).
- [ ] Cancel the event in Calendly → `invitee.canceled` cancels the row and **reopens** the conversation.
- [ ] (Precedence) With **both** a Cal.com event-type and a Calendly URL set, the Qualifier uses **Cal.com** (API booking), not the link.

### Google Calendar / Microsoft 365 booking (OAuth direct)
Prereq: a Google Cloud OAuth app (Calendar scope) and/or an Azure app registration (`Calendars.ReadWrite`, `User.Read`), with client id/secret in env (`GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MICROSOFT_OAUTH_CLIENT_ID/SECRET`) and the redirect URIs `${NEXT_PUBLIC_APP_URL}/api/oauth/{google,microsoft}/callback` registered.
- [ ] Workspace → Agent → **Booking calendar** → **Connect Google Calendar** (or Microsoft 365). You're sent to the provider's consent screen; approving returns to Settings with a green "Connected …" banner showing the account email.
- [ ] Leave Cal.com event-type blank. Set a **Meeting length** + **Earliest/Latest** working hours and Save.
- [ ] As a lead, ask to book. The Qualifier calls `check_availability` and offers open times — only weekday slots inside your window, in the contact's timezone, with your calendar's busy blocks removed.
- [ ] Accept a time. A `/meetings` row appears (source `google`/`m365`, status `scheduled`) with a **Join** link (Google Meet / Teams), the event shows on your real calendar with the lead invited, the lead gets a confirmation message, and the conversation flips to **`booked`**.
- [ ] Double-booking guard: block the chosen time on your calendar between the offer and the booking → `book_meeting` declines and the Qualifier offers another time.
- [ ] From `/meetings`, **Reschedule** and **Cancel** both update the real calendar event; cancel reopens the conversation.
- [ ] **Disconnect** (Booking calendar block) → the connection clears; the Qualifier falls back to Cal.com / Calendly / handoff.
- [ ] (Precedence) Cal.com (key + event type) wins over a connected calendar, which wins over a Calendly link.

### Meeting outcomes (all providers)
- [ ] On a booked meeting in `/meetings`, set **Outcome** = Showed / No-show and toggle **Mark converted**. Both persist (refresh) and are visible in Supabase (`meetings.outcome`, `meetings.converted`). Requires a `rep`+ role.

### Consent capture + revocation
- [ ] An inbound email/SMS reply records a `consents` row for that channel (idempotent — a second reply doesn't duplicate it).
- [ ] Email unsubscribe (footer link or one-click) and SMS **STOP** both revoke consent + add a suppression; the Qualifier then **skips** that contact (suppression banner shows on the thread).

---

_Next phase appends its own section here._

---

# App UI — design-system restyle (2026-10-20)

The product app now renders on the Alevo design system from Claude Design
(design system: https://claude.ai/artifact/QmjsfhrQWLab4yrhNR23Q2 · screen mockups:
https://claude.ai/artifact/P58fQnHgrovgCjc87ERLe1). Hand-check each screen at desktop
(≥1280px) and phone width (≤420px). No data or behaviour changed; only presentation.

## Shell
- [ ] Dark navy ground by default (`#0B1224`), Space Grotesk headings, Inter body, JetBrains Mono for numbers/phones/timestamps.
- [ ] Left sidebar (232px): Alevo mark + wordmark, nav (Dashboard, Conversations, Meetings, Settings) with the active item on a blue tint, the org's **plan card** (name + "Renews <date>") when a subscription row exists, and the Clerk org switcher + user menu at the bottom.
- [ ] Sidebar collapses to a top bar on phones; nav scrolls horizontally; no horizontal page scroll anywhere.
- [ ] Settings → one "Settings" title with tabs **Qualifier · Knowledge · Members · Integrations · Files**; the active tab has a blue underline; each tab renders its page below.
- [ ] **Theme switcher** (sidebar, above the org switcher): Light / Dark / System. Dark is the default in a fresh browser; the choice persists on reload; System follows the OS setting. Clerk's org switcher + user menu re-skin to match.
- [ ] Dark colours match the mockup: canvas `#0B1224`, cards `#111B33`, primary buttons / active tab `#2E9BE6`, agent bubbles violet `#8A5CE8`.
- [ ] Keyboard: Tab through nav/buttons/inputs — a 2px brand ring with a canvas gap shows on every control; toggles show the ring on the track.

## Dashboard (`/dashboard`)
- [ ] Header dot pulses blue + "Live." when the agent is enabled; grey + "The agent is off." with a **Turn the agent on** button otherwise.
- [ ] Four tiles (Leads in, Qualified, Meetings booked, Open conversations) show real counts for the last 7 days (Open = all time) in mono tabular figures.
- [ ] With zero conversations the page shows the **No leads yet** card with a link to the hosted lead form.
- [ ] Recent activity lists the latest 6 conversations (time, name, company, channel, score, status pill) linking to each thread; **Where leads come from** bars sum to 100%.

## Conversations (`/conversations`, `/conversations/[id]`)
- [ ] List is a card table: contact (name + company/email), channel label ("Web form", "SMS"…), status pill ("Qualifying", "Meeting booked", "Handed to a rep", "Not a fit"), score, received time. Empty state reads "No conversations yet…".
- [ ] Thread: contact bubbles left on the raised surface; agent bubbles right in violet; rep replies right in blue. Header shows the status pill and a live dot while the agent is working an open thread.
- [ ] Right panel: fit-score ring (empty + "Not scored yet" when null), details (phone in mono), **Why the score** tint panel when reasons exist, and the booked meeting with its join link.
- [ ] "Reply as the contact (test)" still posts and the agent's reply appears via auto-refresh; validation error shows a red border + message under the box.
- [ ] Suppressed contact → red notice at the top of the thread.

## Meetings (`/meetings`)
- [ ] Tiles: Booked, Showed, No-shows, Converted to clients (computed from the rows). Table: contact (+ join link), when, status pill, source ("Cal.com", "Google Calendar"…), controls.
- [ ] Outcome dropdown is the app's own menu (opens below, arrow keys + Enter work, Escape closes) and saves on pick; **Mark converted** turns blue when converted.
- [ ] **Reschedule** opens a dialog with a date/time field and **Save new time**; an empty field shows an error under the field; saving moves the event and closes the dialog.
- [ ] **Cancel** asks "Cancel the meeting with …?" first; **Keep meeting** closes without change; Escape / backdrop click also close.
- [ ] Confirmation dialogs also guard: Members → Remove / Revoke, Knowledge → Delete, Integrations → Clear, Qualifier → Disconnect calendar.

## Settings
- [ ] **Qualifier**: Booking calendar card shows a Connected / Not connected pill; the form is split into cards (The agent → toggle; Your business; Follow-up; Channels and booking; Calendar booking) with label-left / control-right rows; per-field errors render under the control; **Save changes** bottom-right.
- [ ] **Qualifier – save bar**: no Save button until you change something; then a **floating "Unsaved changes" bar** slides in bottom-right with Discard + Save changes. Discard puts every field (dropdowns included) back to the saved values and hides the bar. Save shows the toast and hides the bar. A form-level error shows inside the bar.
- [ ] **Qualifier – leave guard**: with unsaved changes, click any sidebar/tab link → "Leave without saving?" dialog; **Stay** keeps you on the page with edits intact; **Discard and leave** navigates. Refreshing or closing the tab shows the browser's own "unsaved changes" prompt (the only hook browsers allow there).
- [ ] **Light mode**: text on blue/violet buttons and the switch knob are white; dark mode keeps navy on the brighter fills.
- [ ] **Knowledge**: segmented source tabs (Paste text / Web address / PDF), document rows with status pills ("Queued", "Indexing", "Indexed", "Failed"), Re-index + Delete.
- [ ] **Members**: invite card (Email + Role + Send invite), one table with avatar initials, role select + Save, Remove; pending invites appear in the same table with an amber "Invite pending" line, a role pill and Revoke.
- [ ] **Integrations**: one card per secret with a Set / Not set pill, Save/Replace, Clear, Send test (Slack).
- [ ] Non-admins see an amber notice on Business profile / Agent / Knowledge / Members / Integrations.

## Loading states (site-wide)
- [ ] Every submit button shows a **spinner + "…ing" label and is disabled** while its request runs: Sign in, Create account, Send code, Set new password, Continue with Google (spins until Google loads), the lead form's Send, the test "Send as contact", Save changes (Qualifier bar), Send invite / Save role, Save / Replace / Send test (Integrations), Add to knowledge base / Re-index, Mark converted, Save new time, and every confirm-dialog action (Cancel meeting, Remove member, Revoke invite, Delete document, Clear secret, Disconnect). Choose a file / Choose a PDF show a spinner while uploading.
- [ ] While spinning, a second click does nothing; Cancel / Keep / Discard beside a spinning button are disabled, not spinning.

## Workspace (was "Settings")
- [ ] Sidebar item reads **Workspace** (building icon) and opens `/workspace/profile`; tabs are **Business profile · Agent · Knowledge · Members · Integrations** (Files folded into Knowledge; `/workspace/files` redirects).
- [ ] Old links redirect: `/settings/qualifier` → `/workspace/agent`, `/settings/secrets` → `/workspace/integrations`, `/settings/members` → `/workspace/members` (and the rest).
- [ ] **Business profile** saves company, offering, ideal customer, criteria, disqualifiers, tone and sign-off on its own (toast "Business profile saved."). With the agent **on**, blanking company / offering / ideal customer shows a per-field "Required while the agent is on" error.
- [ ] **Agent** saves on/off, timezone, send window, SMS number, Cal.com ID, Calendly link, meeting length and working hours (toast "Agent settings saved."). Turning it **on** with an incomplete Business profile shows an error under the switch linking to the profile; the hint under the switch also says so beforehand. The Booking calendar card sits below the form; connect / disconnect still work and return to `/workspace/agent`.
- [ ] Both tabs have the floating Unsaved changes bar and the leave guard.

## Knowledge base files + storage
- [ ] Add a PDF on Workspace → Knowledge: the object lands at `organizations/{orgId}/knowledge/{uuid}-{name}` in R2; the row reads "PDF, <size>, added <date>" and moves Queued → Indexing → Indexed.
- [ ] **Delete** a PDF document (the confirm dialog says the file is deleted too): the row disappears, its `kb_chunks` are gone, the object is gone from the bucket, and its `files` ledger row is gone. Deleting a text/URL source removes the row + chunks only.
- [ ] A file name with spaces/odd characters uploads fine (the key is sanitised; the title keeps the original name).

## Toasts (success feedback)
- [ ] Saving the Qualifier, inviting / changing / removing a member, saving / clearing a secret, adding / deleting a knowledge document, uploading a file, recording a meeting outcome, rescheduling, cancelling, and the test "reply as contact" each show a **toast bottom-right** (dark surface, green check) that slides in, stacks if several fire, and **disappears after ~4s**; the **×** closes it early. No inline "Saved." text remains.
- [ ] Toasts follow the theme (light surface in Light mode).
- [ ] Returning from a calendar OAuth connect shows a "Connected your … calendar" toast once and cleans the URL; a connect **error** still renders as the red inline notice.
- [ ] Validation errors are still inline (red border + message under the field), never a toast.

## Page transitions
- [ ] Sidebar navigation (Dashboard → Conversations → Meetings → Settings): the old page fades out quickly and the new page fades in with a slight rise; the sidebar and top bar don't move.
- [ ] Settings tab switches: only the tab content crossfades; the "Settings" title and tab bar stay put.
- [ ] Conversations list (or dashboard activity / meetings contact) → a thread: content slides **left** (forward); the "Conversations" back link at the top of a thread slides **right** (back). Browser back button: plain fade.
- [ ] Clicks during a transition still register (no dead overlay). With the OS reduced-motion setting on, pages swap instantly.

## Sign in / Create account (`/sign-in`, `/sign-up`)
Custom screens over Clerk's sign-in/sign-up flows (no Clerk-hosted UI). Check in a signed-out window.
- [ ] Layout matches the mockup: curved brand-gradient panel on the left with the mark, two floating cards and "Every lead answered."; form column on the right with the logo, **Sign in / Create account** tabs, the form, an "or" rule, **Continue with Google**, and the switch line at the bottom. On a phone the art collapses to a 260px band on top.
- [ ] Clicking the other tab (or the bottom link) slides the blue indicator and fades/rises the new form in place; the URL flips between `/sign-in` and `/sign-up` without a reload. Browser back/forward and deep links to either URL open the right tab.
- [ ] **Sign in**: empty fields show inline errors under each field; a wrong password shows Clerk's message inline (never a toast/alert); a correct one lands on `/dashboard`. The eye icon toggles password visibility.
- [ ] **Forgot password?** → email step → "We sent a code to …" → code + new password → signed in on `/dashboard`. "Use a different email" and "Back to sign in" work.
- [ ] **Create account**: name, company, work email, password, terms checkbox all validate inline; submitting sends a code; the verify step → **Create account** signs you in, creates a workspace named after the company (org switcher shows it), and lands on `/dashboard`. "Send a new code" resends. If Clerk bot-protection is on, its widget appears above the button.
- [ ] **Continue with Google** from either tab round-trips through Google. A brand-new Google user lands on **Pick a workspace** (`/onboarding/choose-organization`): creating one (name prefilled from their first name) opens `/dashboard`; a user who already belongs to workspaces sees them listed with **Open**. Existing users with an active workspace go straight to `/dashboard`.
- [ ] **Invitations** (custom auth): invite an address from Workspace → Members. The email link opens `/sign-up?__clerk_ticket=…` on the public app URL and shows **You're invited**. A brand-new address gets name + password → **Create account and join**, or **Continue with Google** (same email) which signs up via Google and lands on Pick a workspace with the invitation listed under **You've been invited to** → **Accept** opens it → lands in the inviting workspace on `/dashboard` (no verification code; the invite verified the email). An existing account that's signed out gets a one-click **Join the workspace**. An already-signed-in user sees "Opening your new workspace…" and lands in it. In Members the invite moves from pending to a member with the invited role.
- [ ] Pick a workspace: a user with exactly one workspace and a pending session is opened into it automatically; with several, the list shows.
- [ ] Email sign-up creates the workspace from the Company field and lands on `/dashboard` directly; if workspace creation fails it falls back to Pick a workspace instead of bouncing to sign-in.
- [ ] Theme: the screen follows light/dark like the rest of the app.

## Public lead form (`/f/<orgId>`)
- [ ] Centered card on the dark ground; inputs on canvas with control borders; the blue **Send** button; success state in a blue tint panel.
