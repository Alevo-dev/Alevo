# Alevo â€” Manual QA Checklist

Hand-test steps per phase. `[x]` = you've confirmed it. "Where to look" points at the
exact screen. Automated coverage (typecheck, lint, isolation test) runs in CI; this is
the human layer on top.

Dashboards used below:
- **App** â€” `http://localhost:3001`
- **Supabase** â€” Table Editor + SQL Editor
- **Clerk** â€” Configure â†’ Webhooks â†’ your endpoint â†’ Message attempts
- **ngrok** â€” the forwarding terminal (shows each `POST /api/webhooks/clerk`)

---

## Phase 1 â€” Platform foundation (+ billing tables)

### A. Auth & sessions
- [x] Sign up a new user at `/` â†’ redirected into the app.
- [x] Create an organization (header org switcher).
- [x] Sign out, then sign back in â†’ lands on `/dashboard`, session persists.
- [x] While signed out, open `/dashboard` directly â†’ redirected to `/sign-in` (proxy gating).
- [x] While signed in, open `/` â†’ redirected to `/dashboard`.

### B. Identity mirroring (Clerk â†’ our DB)
_Where to look: Supabase Table Editor + ngrok/Clerk webhook logs._
- [x] `organizations` has a row with your org's **name** and a `clerk_id` starting `org_`.
- [x] `users` has your row (`clerk_id` `user_`, your `email`).
- [x] `memberships` has a row linking you to the org with **`role = owner`** (owner bootstrap).
- [x] ngrok terminal shows `POST /api/webhooks/clerk  200` for each event; Clerk â†’ Message attempts show `200`.
- [x] `webhook_events` has one row per delivered event (idempotency ledger).
- [x] In Clerk, **Resend** a past webhook message â†’ still `200`, and **no duplicate rows** appear in our tables.
- [x] Edit your name in Clerk (Account) â†’ `user.updated` fires â†’ your `users` row updates.

### C. Tenancy / RLS
- [x] `/dashboard` shows **your org's name**, your **email**, and **Platform admin: no**.
- [x] Cross-tenant: in a different browser/incognito, sign up a 2nd account + create a 2nd org. Each dashboard shows only its own org â€” never the other's. (This is what the automated isolation test proves; this is the human spot-check.)

### D. Super admin
- [x] In Supabase SQL Editor run:
      `update public.users set is_platform_admin = true where email = '<you>@example.com';`
      Reload `/dashboard` â†’ **Platform admin: yes**.
- [x] **Regression (was a bug):** while platform admin = true, switch organizations in the
      header â†’ the org **name and id on the dashboard update to the newly-selected org**.
      (Fixed: `getCurrentOrg` now scopes explicitly to the active org instead of relying on RLS.)

### E. Billing (schema + seed â€” DB-only; no UI yet)
_These have no screens yet; verify in Supabase._
- [x] `plans` has **3 rows**: starter / growth / scale, with prices 150000 / 300000 / 500000 (cents) and the Â§6 allowances.
- [x] `org_subscriptions` and `usage_counters` tables exist (empty for now).
- [x] (SQL) A normal tenant can read plans but not write them â€” reads are enforced by RLS; subscription/usage writes happen server-side only. _(Covered by the automated test; no manual action needed.)_

### F. Observability (Sentry)
1. Create a Sentry account â†’ **New project** â†’ platform **Next.js** â†’ copy the **DSN**.
2. Put it in `apps/app/.env.local`: `NEXT_PUBLIC_SENTRY_DSN="https://...ingest.sentry.io/..."`.
3. Restart `pnpm --filter @alevo/app dev` (env change).
4. Visit `http://localhost:3001/api/debug/sentry` â†’ it returns a 500 (expected).
- [x] Within ~a minute, **Sentry â†’ Issues** shows **"Alevo Sentry test error"**.
_(With no DSN set, the route still 500s but nothing is sent â€” Sentry is a no-op.)_

---

## Members screen (`/workspace/members`)

_Prereqs: `npx supabase db push` to apply migration 0003; in Clerk â†’ Webhooks,
add the events `organizationInvitation.created`, `organizationInvitation.accepted`,
`organizationInvitation.revoked` to your endpoint (membership events already cover
the rest). Restart the dev server._

### Access
- [x] As owner/admin, header shows a **Members** link â†’ opens `/workspace/members`; you're listed as **owner**.
- [x] As a **rep/viewer** (change your own role in SQL to test), the page shows "You need an admin role to manage members."

### Invite + role-on-invite
- [x] Invite a teammate (email + role, e.g. **admin**) â†’ "Invitation sent"; they appear under **Pending invitations** with that role.
- [x] (DB) `org_invitations` has a `pending` row with the chosen role.
- [x] Accept the invite from another account (incognito) â†’ they join; in **Members** they show the **invited role** (e.g. admin, not the default rep), and the pending invite disappears.
- [x] (DB) that `org_invitations` row is now `accepted`.

### Manage
- [x] Change a member's role â†’ **Save** â†’ persists after reload; (Clerk â†’ the member's org role also flips admin/member).
- [x] **Remove** a member â†’ they disappear from the list and lose access to the org.
- [x] **Revoke** a pending invitation â†’ it disappears; the invite is revoked in Clerk (they can no longer accept).

### Guards
- [x] Try to demote or remove the **last owner** â†’ blocked with an error message.
- [x] A non-owner admin cannot grant/modify the **owner** role (blocked).

---

## Inngest baseline (durable workflows)

_Prereq: in a separate terminal run `npx inngest-cli dev` (it auto-discovers
`http://localhost:3001/api/inngest`). Open the Inngest dev dashboard at
`http://localhost:8288`. The app dev server must also be running._

> Note: `org/provisioned` is **emitted by the app when an org is created** â€” the
> function reacts to it; it does NOT create anything in Clerk.

- [x] The Inngest dev dashboard shows the app synced and the **`org-provisioned`** function registered.
- [x] **Create a new organization** in the app â†’ in the dashboard an **`org/provisioned`** event appears and the function runs to **completion**; in Supabase, `org_subscriptions` gains a **`trialing` Starter** row for that org. (Create a *fresh* org â€” existing ones were created before this step.)
- [x] (Manual trigger) In the dashboard "Send event" `org/provisioned` with a **real org uuid**: `{ "data": { "orgId": "<uuid from organizations>" } }` â†’ a run completes and seeds the subscription. A fake id like `"test"` makes the run **fail** (invalid uuid) â€” which still proves the function executed.
- [x] Re-sending the same event is idempotent â€” no duplicate subscription (org_id is unique).
- [x] Webhook resilience: with the Inngest dev server **stopped**, creating an org still succeeds (the event send is non-fatal) â€” the org still appears in Supabase.

---

## Encrypted org secrets (`/workspace/integrations` â†’ "Integrations")

_Prereq: `npx supabase db push` to apply migration 0004; `SECRETS_MASTER_KEY` set
in `.env.local` (already added); restart the dev server._

### Access
- [x] Header shows **Integrations**; as admin/owner it opens `/workspace/integrations` with the secret registry (Slack webhook, Cal.com key).
- [x] As a **rep/viewer**, the page shows "You need an admin role to manage integrations."

### Validation
- [x] **Slack webhook URL** rejects bad input: `not-a-url` â†’ "Enter a valid URL."; an `http://` URL â†’ "must start with https://"; a non-Slack host (e.g. `https://example.com`) â†’ "Must be a Slack webhook URL (hooks.slack.com)." A real `https://hooks.slack.com/services/â€¦` saves.

### Set / replace / clear
- [x] Enter a value for **Slack webhook URL** â†’ Save â†’ status flips to **Set**; the value is never displayed back.
- [x] **Replace** it with a new value â†’ still **Set** (no error).
- [x] **Clear** it â†’ status returns to **Not set**.

### Encryption at rest (the whole point)
- [x] In Supabase â†’ **`org_secrets`**: after saving, the row's **`ciphertext`** column is gibberish base64 â€” the plaintext (e.g. the Slack URL) appears **nowhere**. `iv` and `auth_tag` are populated.
- [x] Saving the **same** value twice (clear, then set again) produces a **different** ciphertext/iv (random per-encryption nonce).
- [x] The table is service-only: it has no client read path (RLS on, no policy/grant) â€” only server code decrypts, never the browser.

---

## Slack notifications (per org)

_Prereq: a Slack **incoming webhook** URL saved under Integrations (`slack_webhook_url`)._

- [x] On `/workspace/integrations`, with the Slack webhook **set**, click **Send test** â†’ your Slack channel receives "Test notification from Alevo â€” <org>", and the page shows "Sent".
- [x] With the webhook **not set**, the Send test button is disabled.
- [x] A wrong/revoked webhook â†’ the page shows the Slack error (e.g. "Slack returned 404"), and nothing else breaks.

## Super admin console (admin.getalevo.com â€” `apps/admin`)

_Prereq: `npx supabase db push` (applies migration 0005). You must be a platform admin
(`users.is_platform_admin = true`). Run the admin app: `pnpm --filter @alevo/admin dev`
(http://localhost:3002). It reuses the same Clerk + Supabase._

- [x] As a platform admin, sign in at localhost:3002 â†’ the console lists **all** organizations with member count, plan, status, created date.
- [x] As a signed-in **non-platform-admin**, the console shows "Not authorized."
- [x] Perform admin actions in the product app (invite/change role/remove, set/clear a secret) â†’ they appear under **Recent activity** here with the right action + target + org.
- [x] (DB) `audit_log` has a row per action with `actor_user_id` = you.
- [x] The product app (`app.getalevo.com`) no longer has an Admin link or `/admin` route.

## R2 file uploads

_Prereq: `npx supabase db push` (applies migration 0006); R2 env vars set in `.env.local`
(`R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`); the R2 bucket
has a **CORS rule** allowing `PUT` from your app origin (ngrok/localhost). Restart dev._

- [x] On `/workspace/files` (admin), choose a file â†’ it uploads directly to R2; status goes "Requestingâ€¦" â†’ "Uploadingâ€¦" â†’ "Uploaded", and the file appears in the list as **uploaded**.
- [x] (R2 dashboard) the object exists at key `org/<orgId>/<fileId>/<filename>`.
- [x] (DB) `files` has a matching row (`status = uploaded`, size, content type).
- [x] Without R2 env configured, the upload shows a clear "R2 is not configured" error (nothing crashes).
- [x] As a rep/viewer, `/workspace/files` shows "You need an admin role to manage files."

---

# Sprint 2 â€” SDR engine

## Slice 1: capture + conversation view

_Prereq: `npx supabase db push` (applies migration 0007). Restart the app._

### Hosted lead form (public)
- [x] In the app â†’ **Conversations**, copy "Your lead form" link (`/f/<orgId>`), open it in an **incognito/logged-out** tab â†’ the form loads with your org's name (no login required).
- [x] Submit with name + email + message + the consent checkbox â†’ "Thanks â€” we'll be in touch."
- [x] Submitting **without** the consent box â†’ error; without name/email â†’ error.
- [x] A bad org id (`/f/not-a-real-id`) â†’ "This form is not available."

### Conversation shows up
- [x] Back in the app â†’ **Conversations** â†’ the new lead appears (contact name, channel `form`, status `new`). Click it â†’ the thread shows the inbound message + contact details (email/phone/company).
- [x] (DB) `contacts`, `conversations`, `messages` (direction `inbound`, author `contact`), and `consents` (basis `form_submission`) rows all exist.
- [x] Submit the form again with the **same email** â†’ the contact is reused (no duplicate contact), a **new conversation** is created.

### Metering + isolation
- [x] (DB) `usage_counters` has an `inbound_conversations` row for your org + current month, incrementing by 1 per submission.
- [x] A different org's user cannot see these conversations (RLS) â€” the Conversations list is scoped to the active org only.

---

## Slice 4: conversation cadence (follow-up nudges)

_Prereq: `npx supabase db push` (applies migration **0009**). Run the app with
`CADENCE_FAST=1` in `.env.local` so the +1d/+3d/+3d schedule collapses to
~20s/30s/40s, and run `npx inngest-cli dev` (watch its dashboard at
`http://localhost:8288`). The Qualifier must be **enabled** (Settings â†’
Qualifier) with a contact that has an email, or replies just record in-app._

### Send-window settings (`/workspace/agent`)
- [x] The **Follow-up** section shows a timezone select (default "App default (Eastern)") and Earliest/Latest hour selects (default 08:00 / 20:00).
- [x] Set Earliest **later** than Latest â†’ Save â†’ per-field error "The start time must be before the end time." under the hours; nothing saved.
- [x] Pick a real timezone + a valid window â†’ Save â†’ "Saved."; reload â†’ values persist. (DB) `org_profiles.timezone`, `send_window_start_hour`, `send_window_end_hour` updated; `org_profiles_send_window_ck` would reject a bad window at the DB too.

### Arming + nudging
- [x] Submit the hosted form (or use a conversation's "reply as contact"). The Qualifier replies â†’ in the Inngest dashboard a **`conversation-cadence`** run starts (triggered by `conversation/awaiting-reply`) and is sleeping on `gap-0`.
- [x] Leave the lead quiet. After ~20s the first nudge is sent (a new outbound `assistant` message appears in the thread); then a second and third on the next gaps.
- [x] After the third nudge + gap with no reply, the conversation **status flips to `disqualified`** (Conversations list + DB) â€” a non-responsive lead is treated as not a fit.

### Reply cancels the cadence
- [x] Arm a cadence (submit â†’ Qualifier replies). While it's sleeping, **reply as the contact**. In the Inngest dashboard the running `conversation-cadence` is **cancelled** (cancelOn `conversation/message.received`), the Qualifier answers the new message, and a **fresh** cadence arms.
- [x] A lead the Qualifier **disqualified** or **handed off** does **not** arm a cadence (no `awaiting-reply`); an already-running cadence stops at its next `check-*` if the status changed.

### Send windows (timezone)
- [x] Set the org window to a range that **excludes now** (e.g. Earliest 00:00 / Latest 01:00 if it's daytime). Arm a cadence â†’ the nudge step `window-wait-*` sleeps until the window opens instead of sending immediately (visible in the Inngest run timeline). Widen the window â†’ nudges send right away.
- [x] (DB) A lead from the hosted form has `contacts.timezone` set (your browser's tz); that tz â€” not the org default â€” drives its nudge timing.

### Debounce (speed-to-lead trade-off)
- [x] Fire two inbound messages within a few seconds (double "reply as contact"). Only **one** `qualify-conversation` run executes (debounced per conversation), answering both.

---

## Sprint 3 â€” Booking + consent + outcomes

Dashboards: **Cal.com** (Bookings), **Calendly** (Scheduled events + Webhooks), **Inngest** dev UI, **App** `/meetings`, **Supabase** (`meetings`, `consents` tables).

### Cal.com booking (API mode)
- [ ] In Workspace â†’ Integrations set a Cal.com **API key** + **webhook secret**; in Workspace â†’ Agent set the numeric **event-type ID**. The Qualifier now offers to book.
- [ ] As a lead, ask for a meeting. The Qualifier calls `check_availability` and offers real open slots; on acceptance it books â†’ you see the booking in **Cal.com** and a new row in **`/meetings`** (status `scheduled`, source `calcom`), and the lead gets a **confirmation message**.
- [ ] The conversation flips to **`booked`** (terminal â€” Qualifier stops, cadence stops).
- [ ] From `/meetings`, **Reschedule** (pick a new time) and **Cancel** both propagate to Cal.com and update the row; cancel **reopens** the conversation.
- [ ] Cancel/reschedule the booking **in Cal.com directly** â†’ the `/api/webhooks/calcom` sync updates our row (visible in Inngest + the Meetings tab).

### Calendly booking (link mode)
- [ ] Leave the Cal.com event-type **blank**; in Workspace â†’ Agent paste a **Calendly scheduling link** (`https://calendly.com/...`) and set `calendly_webhook_secret` in Integrations. Add a Calendly webhook subscription (invitee.created + invitee.canceled) pointing at `/api/webhooks/calendly`.
- [ ] As a lead, ask to book. The Qualifier sends the **Calendly link** (not slot options) â€” the URL carries `utm_source=alevo` and `utm_content=<conversationId>`.
- [ ] Book through the Calendly link. Calendly fires `invitee.created` â†’ a new **`/meetings`** row appears (source `calendly`, status `scheduled`) and the conversation flips to **`booked`**. Confirm in Inngest the webhook was signature-verified and processed once (idempotent).
- [ ] On a Calendly row, the Meetings tab shows **outcome + converted controls only** â€” no Reschedule/Cancel buttons (managed via Calendly's own links).
- [ ] Cancel the event in Calendly â†’ `invitee.canceled` cancels the row and **reopens** the conversation.
- [ ] (Precedence) With **both** a Cal.com event-type and a Calendly URL set, the Qualifier uses **Cal.com** (API booking), not the link.

### Google Calendar / Microsoft 365 booking (OAuth direct)
Prereq: a Google Cloud OAuth app (`calendar.events` + `calendar.freebusy` scopes; see DEVELOPMENT.md → "Google Calendar OAuth app") and/or an Azure app registration (`Calendars.ReadWrite`, `User.Read`), with client id/secret in env (`GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MICROSOFT_OAUTH_CLIENT_ID/SECRET`) and the redirect URIs `${NEXT_PUBLIC_APP_URL}/api/oauth/{google,microsoft}/callback` registered.
- [ ] Workspace â†’ Agent â†’ **Booking calendar** â†’ **Connect Google Calendar** (or Microsoft 365). Works from **localhost:3001 and from the ngrok URL**: the callback (public in the proxy) stores the grant and sends you back to the origin you started on, so there is no sign-in bounce. You're sent to the provider's consent screen; approving returns to Settings with a green "Connected â€¦" banner showing the account email.
- [ ] Leave Cal.com event-type blank. Set a **Meeting length** + **Earliest/Latest** working hours and Save.
- [ ] As a lead, ask to book. The Qualifier calls `check_availability` and offers open times â€” only weekday slots inside your window, in the contact's timezone, with your calendar's busy blocks removed.
- [ ] Accept a time. A `/meetings` row appears (source `google`/`m365`, status `scheduled`) with a **Join** link (Google Meet / Teams), the event shows on your real calendar with the lead invited, the lead gets a confirmation message, and the conversation flips to **`booked`**.
- [ ] **Booked is final.** After a successful booking the conversation reads **Booked**, never "Handed to a rep" — even if the agent also tries to route it. `handed_off` is reserved for qualified leads a person still has to reach out to and book (no offered time worked, they'd rather be called, pricing/contract questions).
- [ ] A personal Outlook account books a plain event (no Teams link; Join is empty); a work account gets a Teams link. Free/busy works for both.
- [ ] The invite is titled "<Company>: intro call with <Lead>" with a body naming the company; the organizer is the connected account's own mailbox name.
- [ ] Double-booking guard: block the chosen time on your calendar between the offer and the booking â†’ `book_meeting` declines and the Qualifier offers another time.
- [ ] From `/meetings`, **Reschedule** and **Cancel** both update the real calendar event; cancel reopens the conversation.
- [ ] **Disconnect** (Booking calendar block) â†’ the connection clears; the Qualifier falls back to Cal.com / Calendly / handoff.
- [ ] (Precedence) Cal.com (key + event type) wins over a connected calendar, which wins over a Calendly link.

### Meeting outcomes (all providers)
- [ ] On a booked meeting in `/meetings`, set **Outcome** = Showed / No-show and toggle **Mark converted**. Both persist (refresh) and are visible in Supabase (`meetings.outcome`, `meetings.converted`). Requires a `rep`+ role.

### Consent capture + revocation
- [ ] An inbound email/SMS reply records a `consents` row for that channel (idempotent â€” a second reply doesn't duplicate it).
- [ ] Email unsubscribe (footer link or one-click) and SMS **STOP** both revoke consent + add a suppression; the Qualifier then **skips** that contact (suppression banner shows on the thread).

---

_Next phase appends its own section here._

---

# App UI â€” design-system restyle (2026-10-20)

The product app now renders on the Alevo design system from Claude Design
(design system: https://claude.ai/artifact/QmjsfhrQWLab4yrhNR23Q2 Â· screen mockups:
https://claude.ai/artifact/P58fQnHgrovgCjc87ERLe1). Hand-check each screen at desktop
(â‰¥1280px) and phone width (â‰¤420px). No data or behaviour changed; only presentation.

## Shell
- [x] Dark navy ground by default (`#0B1224`), Space Grotesk headings, Inter body, JetBrains Mono for numbers/phones/timestamps.
- [x] Left sidebar (232px): Alevo mark + wordmark, nav (Dashboard, Conversations, Meetings, Settings) with the active item on a blue tint, the org's **plan card** (name + "Renews <date>") when a subscription row exists, and the Clerk org switcher + user menu at the bottom.
- [x] Sidebar collapses to a top bar on phones; nav scrolls horizontally; no horizontal page scroll anywhere.
- [x] Settings â†’ one "Settings" title with tabs **Qualifier Â· Knowledge Â· Members Â· Integrations Â· Files**; the active tab has a blue underline; each tab renders its page below.
- [x] **Theme switcher** (sidebar, above the org switcher): Light / Dark / System. Dark is the default in a fresh browser; the choice persists on reload; System follows the OS setting. Clerk's org switcher + user menu re-skin to match.
- [x] Dark colours match the mockup: canvas `#0B1224`, cards `#111B33`, primary buttons / active tab `#2E9BE6`, agent bubbles violet `#8A5CE8`.
- [x] Keyboard: Tab through nav/buttons/inputs â€” a 2px brand ring with a canvas gap shows on every control; toggles show the ring on the track.

## Dashboard (`/dashboard`)
- [x] Header dot pulses blue + "Live." when the agent is enabled; grey + "The agent is off." with a **Turn the agent on** button otherwise.
- [x] Four tiles (Leads in, Qualified, Meetings booked, Open conversations) show real counts for the last 7 days (Open = all time) in mono tabular figures.
- [x] With zero conversations the page shows the **No leads yet** card with a link to the hosted lead form.
- [x] Recent activity lists the latest 6 conversations (time, name, company, channel, score, status pill) linking to each thread; **Where leads come from** bars sum to 100%.

## Conversations (`/conversations`, `/conversations/[id]`)
- [x] List is a card table: contact (name + company/email), channel label ("Web form", "SMS"â€¦), status pill ("Qualifying", "Meeting booked", "Handed to a rep", "Not a fit"), score, received time. Empty state reads "No conversations yetâ€¦".
- [x] Thread: contact bubbles left on the raised surface; agent bubbles right in violet; rep replies right in blue. Header shows the status pill and a live dot while the agent is working an open thread.
- [x] Right panel: fit-score ring (empty + "Not scored yet" when null), details (phone in mono), **Why the score** tint panel when reasons exist, and the booked meeting with its join link.
- [x] "Reply as the contact (test)" still posts and the agent's reply appears via auto-refresh; validation error shows a red border + message under the box.
- [x] Suppressed contact â†’ red notice at the top of the thread.

## Meetings (`/meetings`)
- [x] Tiles: Booked, Showed, No-shows, Converted to clients (computed from the rows). Table: contact (+ join link), when, status pill, source ("Cal.com", "Google Calendar"â€¦), controls.
- [x] Outcome dropdown is the app's own menu (opens below, arrow keys + Enter work, Escape closes) and saves on pick; **Mark converted** turns blue when converted.
- [x] **Reschedule** opens a dialog with a date/time field and **Save new time**; an empty field shows an error under the field; saving moves the event and closes the dialog.
- [x] **Cancel** asks "Cancel the meeting with â€¦?" first; **Keep meeting** closes without change; Escape / backdrop click also close.
- [x] Confirmation dialogs also guard: Members â†’ Remove / Revoke, Knowledge â†’ Delete, Integrations â†’ Clear, Qualifier â†’ Disconnect calendar.

## Settings
- [x] **Qualifier**: Booking calendar card shows a Connected / Not connected pill; the form is split into cards (The agent â†’ toggle; Your business; Follow-up; Channels and booking; Calendar booking) with label-left / control-right rows; per-field errors render under the control; **Save changes** bottom-right.
- [x] **Qualifier â€“ save bar**: no Save button until you change something; then a **floating "Unsaved changes" bar** slides in bottom-right with Discard + Save changes. Discard puts every field (dropdowns included) back to the saved values and hides the bar. Save shows the toast and hides the bar. A form-level error shows inside the bar.
- [x] **Qualifier â€“ leave guard**: with unsaved changes, click any sidebar/tab link â†’ "Leave without saving?" dialog; **Stay** keeps you on the page with edits intact; **Discard and leave** navigates. Refreshing or closing the tab shows the browser's own "unsaved changes" prompt (the only hook browsers allow there).
- [x] **Light mode**: text on blue/violet buttons and the switch knob are white; dark mode keeps navy on the brighter fills.
- [x] **Knowledge**: segmented source tabs (Paste text / Web address / PDF), document rows with status pills ("Queued", "Indexing", "Indexed", "Failed"), Re-index + Delete.
- [x] **Members**: invite card (Email + Role + Send invite), one table with avatar initials, role select + Save, Remove; pending invites appear in the same table with an amber "Invite pending" line, a role pill and Revoke.
- [x] **Integrations**: one card per secret with a Set / Not set pill, Save/Replace, Clear, Send test (Slack).
- [x] Non-admins see an amber notice on Business profile / Agent / Knowledge / Members / Integrations.

## Loading states (site-wide)
- [x] Every submit button shows a **spinner + "â€¦ing" label and is disabled** while its request runs: Sign in, Create account, Send code, Set new password, Continue with Google (spins until Google loads), the lead form's Send, the test "Send as contact", Save changes (Qualifier bar), Send invite / Save role, Save / Replace / Send test (Integrations), Add to knowledge base / Re-index, Mark converted, Save new time, and every confirm-dialog action (Cancel meeting, Remove member, Revoke invite, Delete document, Clear secret, Disconnect). Choose a file / Choose a PDF show a spinner while uploading.
- [x] While spinning, a second click does nothing; Cancel / Keep / Discard beside a spinning button are disabled, not spinning.

## Workspace (was "Settings")
- [x] Sidebar item reads **Workspace** (building icon) and opens `/workspace/profile`; tabs are **Business profile Â· Agent Â· Knowledge Â· Members Â· Integrations** (Files folded into Knowledge; `/workspace/files` redirects).
- [x] Old links redirect: `/settings/qualifier` â†’ `/workspace/agent`, `/settings/secrets` â†’ `/workspace/integrations`, `/settings/members` â†’ `/workspace/members` (and the rest).
- [x] **Business profile** saves company, offering, ideal customer, criteria, disqualifiers, tone and sign-off on its own (toast "Business profile saved."). With the agent **on**, blanking company / offering / ideal customer shows a per-field "Required while the agent is on" error.
- [x] **Agent** saves on/off, timezone, send window, SMS number, Cal.com ID, Calendly link, meeting length and working hours (toast "Agent settings saved."). Turning it **on** with an incomplete Business profile shows an error under the switch linking to the profile; the hint under the switch also says so beforehand. The Booking calendar card sits below the form; connect / disconnect still work and return to `/workspace/agent`.
- [x] Both tabs have the floating Unsaved changes bar and the leave guard.

## Knowledge base files + storage
- [x] Add a PDF on Workspace â†’ Knowledge: the object lands at `organizations/{orgId}/knowledge/{uuid}-{name}` in R2; the row reads "PDF, <size>, added <date>" and moves Queued â†’ Indexing â†’ Indexed.
- [x] **Delete** a PDF document (the confirm dialog says the file is deleted too): the row disappears, its `kb_chunks` are gone, the object is gone from the bucket, and its `files` ledger row is gone. Deleting a text/URL source removes the row + chunks only.
- [x] A file name with spaces/odd characters uploads fine (the key is sanitised; the title keeps the original name).

## Toasts (success feedback)
- [x] Saving the Qualifier, inviting / changing / removing a member, saving / clearing a secret, adding / deleting a knowledge document, uploading a file, recording a meeting outcome, rescheduling, cancelling, and the test "reply as contact" each show a **toast bottom-right** (dark surface, green check) that slides in, stacks if several fire, and **disappears after ~4s**; the **Ã—** closes it early. No inline "Saved." text remains.
- [x] Toasts follow the theme (light surface in Light mode).
- [x] Returning from a calendar OAuth connect shows a "Connected your â€¦ calendar" toast once and cleans the URL; a connect **error** still renders as the red inline notice.
- [x] Validation errors are still inline (red border + message under the field), never a toast.

## Page transitions
- [x] Sidebar navigation (Dashboard â†’ Conversations â†’ Meetings â†’ Settings): the old page fades out quickly and the new page fades in with a slight rise; the sidebar and top bar don't move.
- [x] Settings tab switches: only the tab content crossfades; the "Settings" title and tab bar stay put.
- [x] Conversations list (or dashboard activity / meetings contact) â†’ a thread: content slides **left** (forward); the "Conversations" back link at the top of a thread slides **right** (back). Browser back button: plain fade.
- [x] Clicks during a transition still register (no dead overlay). With the OS reduced-motion setting on, pages swap instantly.

## Sign in / Create account (`/sign-in`, `/sign-up`)
Custom screens over Clerk's sign-in/sign-up flows (no Clerk-hosted UI). Check in a signed-out window.
- [x] Layout matches the mockup: curved brand-gradient panel on the left with the mark, two floating cards and "Every lead answered."; form column on the right with the logo, **Sign in / Create account** tabs, the form, an "or" rule, **Continue with Google**, and the switch line at the bottom. On a phone the art collapses to a 260px band on top.
- [x] Clicking the other tab (or the bottom link) slides the blue indicator and fades/rises the new form in place; the URL flips between `/sign-in` and `/sign-up` without a reload. Browser back/forward and deep links to either URL open the right tab.
- [x] **Sign in**: empty fields show inline errors under each field; a wrong password shows Clerk's message inline (never a toast/alert); a correct one lands on `/dashboard`. The eye icon toggles password visibility.
- [x] **Forgot password?** â†’ email step â†’ "We sent a code to â€¦" â†’ code + new password â†’ signed in on `/dashboard`. "Use a different email" and "Back to sign in" work.
- [x] **Create account**: name, company, work email, password, terms checkbox all validate inline; submitting sends a code; the verify step â†’ **Create account** signs you in, creates a workspace named after the company (org switcher shows it), and lands on `/dashboard`. "Send a new code" resends. If Clerk bot-protection is on, its widget appears above the button.
- [x] **Continue with Google** from either tab round-trips through Google. A brand-new Google user lands on **Pick a workspace** (`/onboarding/choose-organization`): creating one (name prefilled from their first name) opens `/dashboard`; a user who already belongs to workspaces sees them listed with **Open**. Existing users with an active workspace go straight to `/dashboard`.
- [x] **Invitations** (custom auth): invite an address from Workspace â†’ Members. The email link opens `/sign-up?__clerk_ticket=â€¦` on the public app URL and shows **You're invited**. A brand-new address gets name + password â†’ **Create account and join**, or **Continue with Google** (same email) which signs up via Google and lands on Pick a workspace with the invitation listed under **You've been invited to** â†’ **Accept** opens it â†’ lands in the inviting workspace on `/dashboard` (no verification code; the invite verified the email). An existing account that's signed out gets a one-click **Join the workspace**. An already-signed-in user sees "Opening your new workspaceâ€¦" and lands in it. In Members the invite moves from pending to a member with the invited role.
- [x] Pick a workspace: a user with exactly one workspace and a pending session is opened into it automatically; with several, the list shows.
- [x] Email sign-up creates the workspace from the Company field and lands on `/dashboard` directly; if workspace creation fails it falls back to Pick a workspace instead of bouncing to sign-in.
- [x] Theme: the screen follows light/dark like the rest of the app.

## Public lead form (`/f/<orgId>`)
- [x] Centered card on the dark ground; inputs on canvas with control borders; the blue **Send** button; success state in a blue tint panel.

---

# Custom account + workspace menus (2026-10-21)

The last two embedded Clerk components (`<UserButton>`, `<OrganizationSwitcher>`) are
replaced by our own menus, matching Clerk's popovers in size and features on our tokens
(`components/user-menu.tsx` + `components/account-dialog.tsx`,
`components/workspace-switcher.tsx`, on the `Menu` primitive in `components/ui/menu.tsx`).
Clerk still provides the data + session; only the UI is ours.

## Account menu (top-right avatar)
- [ ] The avatar shows your photo (Google users) or your initials on brand blue (email users).
- [ ] Clicking it opens **our** menu (design-system surface, right-aligned under the avatar): your avatar + name + email at the top, then **Manage account** and **Sign out** — no Clerk popover anywhere. Clerk-sized rows (~44px) and panel (~288px).
- [ ] Keyboard: focus the avatar → Enter/ArrowDown opens, arrows move, Enter activates, Escape closes and returns focus. Click outside closes.
- [ ] **Sign out** shows a spinner in the trigger and lands on `/sign-in`.
- [ ] Both themes: the menu follows light/dark.

## Manage account (our two-pane dialog, 1:1 with Clerk's Account modal)
- [ ] Opens wide (two panes): left rail "Account / Manage your account info." with **Profile** and **Security** nav (active item on a blue tint); × top-right; stacks vertically on a phone.
- [ ] **Profile → Profile row**: avatar + name, **Update profile** on the right → swaps to an edit form (Add/Change/Remove photo, first/last name, Save/Cancel). Empty first name → inline error; saving shows "Profile saved." and the menu header updates; the new photo shows everywhere.
- [ ] **Profile → Email addresses**: every address listed with **Primary** / **Unverified** pills and a ⋯ menu (Set as primary · Verify email · Remove email — Remove asks first). **+ Add email address** → email form → "Send code" → code form → Verify → "Email address verified." and the new address appears. The code arrives at the new address.
- [ ] **Profile → Connected accounts**: Google shows the colour "G", provider + email; ⋯ → Remove connection (confirm dialog). A disconnected account shows "This account has been disconnected. **Reconnect**" and Reconnect round-trips through Google.
- [ ] **Security → Password**: with a password set, shows •••••••••• + **Change password** (current + new, inline errors, "Password updated."); a Google-only account shows **Set password** (no current-password field) and can then sign in with it.
- [ ] **Security → Active devices**: this browser listed with "This device", browser + version, IP + location (mono), last-active time. A second signed-in browser appears too; its ⋯ → **Sign out of device** (confirm) removes it and that browser is signed out on next action.
- [ ] **Security → Delete account**: red link → confirm dialog → deleting lands on `/sign-in` and the user is gone from Members (webhook mirror).
- [ ] Escape / backdrop / × close the dialog (blocked while a save is in flight).

## Create workspace (our dialog, 1:1 with Clerk's create-organization modal)
- [ ] Layout: title + ×, **Logo** (square upload tile, Upload button, "Recommended size 1:1, up to 10MB."), **Name** field, one **Create workspace** button bottom-right.
- [ ] Picking an image previews it in the tile (Change / Remove appear); a file over 10MB → inline error.
- [ ] Creating with a logo: the new workspace's logo shows in the switcher trigger + menu after the reload.

## Workspace picker (sidebar, bottom)
- [ ] The trigger shows the active workspace (initials tile or logo + name) and opens **upward** from the bottom of the sidebar (downward on the phone top-bar if there's room).
- [ ] The menu matches Clerk's switcher: the **active workspace** (avatar + "Current workspace") on top, **Workspace settings** → `/workspace/profile`, then your **other** workspaces with avatar tiles, then **Create workspace** (dashed plus tile). More than 10 workspaces all appear (pagination is auto-fetched).
- [ ] Picking another workspace shows a spinner in the trigger, then a **full page load** into `/dashboard` with that org's data everywhere (sidebar plan card, conversations, workspace tabs). No stale data from the previous org on any screen.
- [ ] **Create workspace** opens our Dialog (not Clerk's modal): empty name → inline error under the field; a real name creates it, switches to it, and lands on `/dashboard`; the Clerk webhook mirrors the new org (`organizations` row in Supabase).
- [ ] Cancel / Escape / backdrop close the dialog; buttons disable while creating.
- [ ] A member invited to a second org sees both and can hop between them; each shows only its own data (RLS spot-check).
- [ ] Nothing in the app renders Clerk-hosted UI anymore (the only Clerk surfaces left are the invisible OAuth callback and the session itself).

---

## Twilio SMS loop (end-to-end)

Tests the full inbound -> qualify -> outbound SMS cycle on a real phone.
Dashboards: **Twilio Console** (Phone Numbers, Messaging logs, Monitor > Logs > Errors),
**ngrok** terminal (shows each `POST /api/webhooks/twilio`), **Inngest** dev UI
(`:8288`), **App** `/conversations`, **Supabase** (`conversations`, `messages`,
`contacts`, `consents`, `usage_counters`).

### Setup (once)
- [ ] Platform creds in `.env.local`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`. Restart `pnpm dev:app`.
- [ ] A Twilio number is bought/assigned (SMS-capable). In `/workspace/agent`, set the **SMS number (Twilio)** in E.164 (e.g. `+15551234567`) and Save. (DB: `org_profiles.sms_from_number` is set and unique to this org.)
- [ ] The Qualifier is **enabled** (Agent on; Business profile complete).
- [ ] Run the tunnel + event bus: `pnpm tunnel` (ngrok -> app :3001) and `pnpm inngest` (processes `conversation/message.received`). Both must stay running.
- [ ] In Twilio Console, the number's **"A message comes in"** webhook = `https://<your-ngrok-domain>/api/webhooks/twilio`, method **POST**. (Prod uses the Vercel URL.)
- [ ] (Trial accounts) your personal phone is a **Verified Caller ID**, and remember trial messages are prefixed by Twilio. Upgrade out of trial to text unverified numbers.

### Inbound -> conversation
- [ ] From your phone, text anything to the Twilio number. The ngrok terminal shows `POST /api/webhooks/twilio 200`; Inngest shows a `conversation/message.received` run.
- [ ] A conversation appears in `/conversations` with channel **SMS**; opening it shows your inbound message. (DB: a `contacts` row matched/created by your `From` phone; a `messages` row, channel `sms`, `provider_ref` = Twilio `MessageSid`.)
- [ ] A brand-new SMS conversation increments `usage_counters` (metered once).

### Qualify -> outbound (the loop)
- [ ] Within a few seconds the Qualifier replies and your phone receives an SMS **from the Twilio number**. The reply is short/human (SMS style: one question at a time, not a full email).
- [ ] The reply is recorded in the thread as an outbound `assistant` `sms` message. Twilio Messaging logs show an outbound segment delivered.
- [ ] Reply from your phone again -> it threads into the **same** conversation, the Qualifier answers again. The loop continues turn by turn.
- [ ] Carry it to an end state: give qualifying info -> the Qualifier scores fit and either books / hands off / disqualifies (status pill updates), and texts a closing message.

### Opt-out + edge cases
- [ ] Text **STOP** to the number. Twilio blocks further messages at the carrier level; our side records the opt-out (a `consents` revoke + suppression). The Qualifier no longer texts that contact; the thread shows the suppression/opt-out state.
- [ ] Text **START** (resubscribe) -> messaging resumes; a later inbound is handled normally again.
- [ ] Idempotency: Twilio retries (or you re-point a second webhook) do **not** create duplicate `messages` rows (dedup on `MessageSid`).
- [ ] Routing: if a second org has its own number, an inbound to that number opens a conversation in **that** org only (never cross-tenant).
- [ ] Fallback when SMS isn't configured: with no `sms_from_number` (or Twilio keys unset), the Qualifier falls through to email, then in-app, and never crashes the turn.
- [ ] Signature check: a `POST /api/webhooks/twilio` with a bad/missing `X-Twilio-Signature` is rejected (not processed).

### Prod notes
- [ ] A2P 10DLC registration is the gate for US SMS at volume - confirm the number/campaign is registered before real sends.
- [ ] Vercel has `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`; the Twilio number's webhook points at the production `/api/webhooks/twilio`.

---

## Clerk v7 auth flows (2026-10-21)

Tests the custom auth UI after upgrading @clerk/nextjs from v6 to v7 (signals API). All flows use the new v7 API: reactive `errors` signals, `signIn.password()` + `finalize()`, email code verification, Google OAuth via `sso()`, and error handling off the signals rather than try/catch.

Dashboards: **App** (`http://localhost:3001`), **Clerk Dashboard** (Users, Sessions).

### Setup
- [ ] `pnpm dev:app` runs; Clerk instance is v7 (check `@clerk/nextjs` in `package.json` → `^7.x.x`).
- [ ] `.env.local` has `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`.
- [ ] Go to `/sign-in`.

### Sign up → new workspace
- [ ] Click "Create account".
- [ ] **Details:** fill in First name, Last name, Email, Password, accept legal. Field errors appear inline under the input.
- [ ] **Send code:** after submit, form says "We've sent a code to [email]"; code input appears.
- [ ] **Enter code:** paste from email, submit. "Creating your workspace…" briefly shows.
- [ ] **Success:** land on `/dashboard` showing empty conversations. Clerk created the org; your `memberships` row has role `owner`.

### Sign in → existing user
- [ ] Sign out (user menu → Sign out, lands on `/sign-in`).
- [ ] Enter email + password. Wrong password shows error inline.
- [ ] Correct password: land on `/dashboard` (no "already signed in" error).

### Already signed in → no form flash
- [ ] Signed in, visit `/sign-in` or `/sign-up` directly. Page redirects to `/dashboard` **instantly** (no sign-in form shown, even briefly). Same in both tabs.

### Forgot password
- [ ] On sign-in, click "Forgot password?".
- [ ] Enter email, submit. "We've sent a code to [email]".
- [ ] Enter code from email, enter new password. "Password updated; redirecting…" lands on `/sign-in`.

### Google OAuth
- [ ] On sign-in or sign-up, click "Sign in with Google".
- [ ] Authenticate with Google.
- [ ] **New user:** lands on `/dashboard` (auto-created account + org).
- [ ] **Existing user:** lands on `/dashboard` directly.

### Invite acceptance (already signed in)
- [ ] Sign in as User A (admin).
- [ ] In a **different browser**, click an invite link.
  - **New user:** sign-up flow, then `/onboarding/choose-organization` → Accept → lands in User A's workspace.
  - **Existing user (already signed in):** redirected straight to `/onboarding/choose-organization` (no "already signed in" error) → Accept.
- [ ] User B is now in Members (with the invited role).

### Edge cases
- [ ] Invalid code: "Invalid code" appears inline; a "Send new code" button resends.
- [ ] Code expired: "Code expired" with a "Send new code" button.
- [ ] Empty fields: local validation only; "This field is required" inline.

---

## Manage workspace dialog (2026-10-21)

Tests the new workspace picker "Manage" feature: org profile edit, member management, Leave/Delete with cascading deletion. All destructive actions are gated by confirm dialogs.

Dashboards: **App** `/dashboard`, **Supabase** (orgs, memberships, conversations, messages).

### Manage button → dialog
- [ ] Click workspace name in sidebar, then the small **Manage** button (gear icon + text).
- [ ] Modal opens, two-pane: left tabs (**General**, **Members**), right content. Close button (X). Escape closes it.

### General tab: org profile
- [ ] **Workspace profile:** shows org name + logo (or initials).
- [ ] Click "Update profile" → editor: logo upload, name input.
- [ ] Upload a logo. File > 10MB → "The logo must be 10MB or less."
- [ ] Change name, click Save. Toast: "Workspace updated." Logo + name update in real-time in the header.

### General tab: Leave workspace
- [ ] **Leave workspace,** click the red link.
- [ ] Confirm: "Leave this workspace?" Click the red button.
- [ ] Toast/working state, then land on `/dashboard` and the workspace is gone from your picker. (Deleted in Clerk + our DB.)
- [ ] **Sole owner:** confirm text changes to "You're the only owner…"; Leave is disabled.

### General tab: Delete workspace
- [ ] **Delete workspace,** click the red link.
- [ ] Confirm: "Delete [Name]?" with a scary description. Click the red button.
- [ ] Land on `/dashboard`. Workspace gone. Supabase: the org row is deleted (CASCADE wipes conversations/messages/members).

### Members tab: list + invite
- [ ] Members tab shows members with: name+email, joined date, role dropdown, red trash-can (remove).
- [ ] Invitations tab shows pending with: email, "Invite pending" tag, role, red trash-can (revoke).
- [ ] Both tabs have a search bar and **Invite** button.

### Members tab: add invite
- [ ] Click Invite. Form appears: email, role dropdown (default Rep), Send invite.
- [ ] Fill email, pick role, Send. Toast: "Invitation sent."
- [ ] Invitations tab shows the email (pending).

### Members tab: change role
- [ ] On a member, click role dropdown, pick a new role. **Save** button appears.
- [ ] Click Save. Toast: "Role updated."

### Members tab: remove member
- [ ] Click red trash-can on a member.
- [ ] Confirm dialog: "Remove [Name]?" Click red button.
- [ ] Toast: "Member removed." Member disappears.

### Members tab: revoke invite
- [ ] On a pending invite, click red trash-can.
- [ ] Confirm: "Revoke the invite for [email]?" Click red button.
- [ ] Toast: "Invite revoked." Invite disappears.

### Red trash-can across the app
- [ ] Every remove/delete row button is a small red trash-can icon (no text).
- [ ] Hover → light red tint. Click → confirm dialog, no banners.
- [ ] Spot-check: Members remove/revoke (done above), account profile remove photo, Knowledge delete document, create-workspace remove logo.

### Edge cases
- [ ] Search: enter a name/email in Members/Invitations → real-time filter.
- [ ] Non-admin viewing Members: "You need an admin role to manage members." (No invite button, no list.)
- [ ] Multiple orgs: each workspace's Manage shows **only** that workspace's members + invites.
- [ ] Dialog closes on Escape / backdrop / X. Unsaved profile edits are discarded (no warning).

## Integrations page matches the Claude Design mockup (2026-10-22)

Workspace → Integrations (`/workspace/integrations`).

### Layout
- [ ] Heading "Connected services" then a grid of cards: Cal.com, Calendar, Calendly, Twilio, Resend, Slack. 3 columns on desktop, 2 on tablet, 1 on phone (no horizontal scroll).
- [ ] Each card: dashed logo tile, name, one-line hint, status dot + label, and a button on the right.
- [ ] Each card shows the brand's own mark in its colours on a white tile: Cal.com, Google Calendar + Microsoft squares (Calendar), Calendly, Twilio red, Resend, Slack. Marks are sharp at 40px.
- [ ] No API keys section below the grid. The keys live in the Manage dialogs.

### Status is derived from real state
- [ ] Fresh org: every service shows "Not connected" (grey dot). Resend and Twilio show "Not set up" when their platform env vars are missing.
- [ ] Save a Slack webhook URL. Slack card turns green "Connected". Clear it: back to "Not connected".
- [ ] Save a Cal.com API key without a webhook secret. Cal.com shows "Connected" and **Needs attention** lists "Cal.com webhook secret missing" with a Review link. Save the webhook secret: the Needs attention block disappears.
- [ ] Twilio with platform keys set but no SMS number: "No number" in amber, listed under Needs attention. Set the number in Workspace → Agent, come back: "Connected".

### Buttons
- [ ] Cal.com, Calendly, Slack "Manage" opens a dialog titled with the service name, holding its key cards. Esc, backdrop and X close it; the page does not scroll.
- [ ] Calendar and Twilio "Manage" opens a dialog with a note and an **Open Agent** button that goes to Workspace → Agent.
- [ ] Resend has no Manage button (platform-level).
- [ ] A "Needs attention" row's **Review** opens the same dialog as that service's Manage.
- [ ] A dialog has one **Save** and one **Cancel**, and no Save on each key. Both are hidden until a field has text in it.
- [ ] Type in one key: Save and Cancel appear beside each other. Cancel empties the fields and hides both.
- [ ] Type in two keys, leave one blank: Save stores only the filled one(s). Toast "Keys saved." Fields empty, buttons hide, and the Set/Not set pills update.
- [ ] Enter an invalid Slack URL with a valid Cal.com key: nothing saves, the Slack field shows its error in red beneath it.
- [ ] Clearing and Send test sit under "Saved keys", each with its own action, not inside the form.
- [ ] Non-admin: the key cards are read-only (inputs disabled), but the service cards still show status.

### Stays as it was
- [ ] Saving or clearing a key still shows the toast and per-field errors (Slack URL format, required value).
- [ ] Values are never shown again after saving (no reveal buttons in the mockup were added, by design).

## Connection health card (2026-10-22)

Requires migration `0017_webhook_deliveries.sql` applied to the dev DB (`npx supabase db push`). To see data without real traffic, run `supabase/seed-dev-health.sql` in the dev SQL editor (~80 deliveries per workspace over the last 24h, ~10% failed); its last statement deletes them again.

- [ ] Workspace → Integrations: "Connection health" card sits at the top. Subtitle: "Last 24 hours across all connected services".
- [ ] Fresh org: body reads "No webhooks in the last 24 hours…", no line, no stat tiles.
- [ ] Send a Cal.com test webhook or a booking through Calendly. Reload: the card shows "Webhooks ok" with a percentage and "Failed" with a count. The line draws in once.
- [ ] A webhook with a bad signature (e.g. Twilio with a wrong token) counts as failed. Failed goes up by one; the percentage drops.
- [ ] Another workspace's deliveries don't change this workspace's card.
- [ ] Phone width: the card and both tiles stack with no horizontal scroll.

### Health and Needs attention layout
- [ ] Desktop: Connection health (left, narrower) and Needs attention (right) sit side by side at the same height.
- [ ] Mobile: the two cards stack, Connection health first, Needs attention below, with no horizontal scroll.
- [ ] With nothing needing attention, the right card reads "Nothing needs attention. Every connected service is set up."
- [ ] With an issue, each row shows a Warning dot and a **Review** button that opens that service's dialog.

## Inbound voice — Sprint 4 (2026-10-22)

Built, but **not yet verified against a live call**. The Vapi API details that the research could not confirm are listed below; check each one on the first test call and fix the code if the payload differs.

Setup (once per environment):
- [ ] Migration `0018_voice.sql` applied (`npx supabase db push`).
- [ ] `VAPI_API_KEY` and `VOICE_WEBHOOK_SECRET` set; `NEXT_PUBLIC_APP_URL` points at a public URL Vapi can reach (use an ngrok or the Vercel URL, not localhost).
- [ ] The org has a Twilio number (Agent → phone number), and its business profile is filled in.
- [ ] Inngest dev server running (`npx inngest-cli dev`) so `process-voice-call` runs.

Turning calls on:
- [ ] Agent → Phone calls: turn on "Answer calls" → Save. Save appears only once something changed; Cancel sits beside it.
- [ ] With no phone number set, turning calls on shows the error under the switch; nothing is sent to Vapi.
- [ ] In Vapi's dashboard: the assistant exists, and the number is attached to it.

Live call (dial the number from a phone):
- [ ] Greeting plays and says "This call may be recorded."
- [ ] Ask a question covered by the knowledge base. The agent answers from it (or says it'll follow up if nothing matches).
- [ ] Ask for a meeting. Agent offers times from the connected calendar, takes your email, books. A calendar invite arrives and the thread shows "booked".
- [ ] Ask for a person. Slack gets "Call escalated: …", and the thread is handed off.
- [ ] Hang up. Within a minute: a `calls` row exists, the thread has a call summary, Slack gets "Call ended (…)", and the org's voice minutes go up.
- [ ] The recording plays back: check the R2 object at `organizations/<org>/calls/<callRef>.<ext>`.
- [ ] Duplicate end-of-call report (replay it from Vapi): nothing is double-counted or double-posted.

After hours (outside booking hours, weekday):
- [ ] The greeting changes to the "we're closed" version and the agent takes a message, then calls take_message (Slack shows it).

Off:
- [ ] Turn calls off → Save. A call now gets "we're not taking calls right now, please text this number."

**Unverified against Vapi's docs, check on the first call:**
- [ ] Tool definitions: `model.tools` as `{ type: "function", function: { name, description, parameters } }`, routed to the assistant's server URL. Look at a real `tool-calls` body.
- [ ] Tool results come back as `{ results: [{ name, toolCallId, result }] }` and the agent speaks them.
- [ ] The secret arrives in the `x-alevo-secret` header (we set it through `server.headers`). If Vapi rejects the assistant, check the `server` field name.
- [ ] `assistant-request`: the response `{ assistant: {...} }` is honoured per call, so after-hours and off-mode take effect. If calls always get the open greeting, this shape is wrong.
- [ ] `end-of-call-report` field paths: `message.call.id`, `message.call.phoneNumberId`, `message.call.customer.number`, `message.endedReason`, `message.summary`, `message.durationSeconds`, `message.artifact.transcript`. Log one raw payload and compare.
- [ ] Recording download: `GET /call/{id}/mono-recording` returns audio (it redirects to a signed URL).
- [ ] The model id `claude-sonnet-5` is accepted by Vapi's Anthropic provider.

Not built yet (say if you want them now): buying a new Twilio number from inside Alevo, new-vs-existing client routing, warm transfer, and a Calls list page (calls appear in the thread for now).

### Voice: fit score and lead status
- [ ] After a call where the caller qualifies, the conversation shows a fit score and reasons (same fields as the Qualifier).
- [ ] A call that ends with the caller wanting a person: conversation status is "Handed to a rep" and Slack shows the handoff note.
- [ ] A call with a clear non-fit: status is "Not a fit" (this is the "dismissed" state).
- [ ] A call that books: status is "booked". Afterwards no later set_status changes it.
- [ ] The call's outcome in the Calls record matches the conversation status.

## Page transitions re-enabled for testing (2026-10-22)

`components/page-transition.tsx` wraps the app and workspace templates in React's `ViewTransition` again (it was switched off in commit 95129cf). Timings are in `globals.css` under "View transitions" (~120ms).

- [ ] Click between sidebar pages (Dashboard → Conversations → Meetings): the old page fades out and the new one rises in.
- [ ] Open a conversation from a list, then press the back link: the list slides in from the left, the conversation slides out to the right.
- [ ] Switch Workspace tabs (Profile → Agent → Integrations): content fades and rises; the title and tabs stay still.
- [ ] Time a navigation with and without the transition (for example by commenting the wrapper out). Note whether it feels slower; the earlier reason for switching it off was that it did.
- [ ] `prefers-reduced-motion` on: transitions are off.

## Booking in one place (2026-10-22)

Requires migration `0019_booking_tool.sql` applied (`npx supabase db push`). It backfills each org's current tool from the old precedence (Cal.com → connected calendar → Calendly), so nothing should change for an org that already booked.

Workspace → Agent → **Booking** card:
- [ ] "Book meetings" switch off: nothing beneath it. On: four tool cards (Cal.com, Google Calendar, Microsoft 365, Calendly) with their marks; exactly one selected.
- [ ] Only the chosen tool's fields show beneath the cards. Switching tools swaps the fields; nothing from another tool is visible.
- [ ] One Save bar for the whole card (appears once anything changed, with Discard). No per-field Save buttons anywhere on the page.
- [ ] Cal.com: event type ID + API key + webhook secret all here, with Set/Not set pills. Save with the key blank when "Not set" → red error under the key field. Enter a key + a numeric event type → saved; Integrations shows Cal.com "Connected".
- [ ] Google Calendar / Microsoft 365 chosen, nothing connected: "Connect …" button. Click → booking settings are saved first (toast), then the Google/Microsoft consent screen opens; on return the card shows the connected account + Disconnect.
- [ ] Connected provider differs from the chosen one (e.g. Google connected, Microsoft chosen): the card says to disconnect first; Disconnect asks for confirmation, then the Connect Microsoft button appears.
- [ ] Meeting length + working hours only show for Google/Microsoft (Cal.com uses its own rules).
- [ ] Calendly chosen with no link saved: Save shows "Add the Calendly scheduling link under Integrations first." The card links to Integrations.
- [ ] Turn booking off → Save. Integrations shows every booking tool "Not chosen". Turn it back on: the previous tool and its details are still there.
- [ ] The old "Channels and booking" card is now "Channels" with only the SMS number. No event-type or Calendly fields on it.

Workspace → Integrations:
- [ ] Cal.com and Calendar cards: Manage opens a dialog that points to Agent → Booking (no keys here any more).
- [ ] Calendly card → Manage: scheduling link + webhook signing key in ONE form with one Save/Cancel (appear once something changed). An invalid link shows a red error under it.
- [ ] Status words match the choice: "Not chosen" (another tool chosen), "Needs setup" + a Needs attention row (chosen but missing details), "Connected" (chosen and configured).
- [ ] Qualifier end to end: with the chosen tool configured, a qualified lead gets `check_availability` / `book_meeting` (or the Calendly link). With booking off, the agent hands off instead — even if a Cal.com key is still stored.

## Code + performance pass (2026-10-22)

Behaviour should be unchanged; these checks catch regressions from the cleanup.

App:
- [ ] Navigate Dashboard → Conversations → Meetings → Workspace: a skeleton (title, three stat tiles, a five-row table) shows instantly in the content column while each page loads (new `(app)/loading.tsx`); the sidebar/top bar stay put.
- [ ] The skeleton blocks shimmer — a soft highlight sweeps left→right, staggered down the page. With "reduce motion" on in the OS they sit still.
- [ ] Workspace tabs (Profile → Agent → Knowledge → Integrations): the next tab's body appears INSTANTLY as settings-shaped placeholders (card header + label/control rows) while it loads; the "Workspace" title and the tab strip never flicker. No more frozen old tab.
- [ ] Conversations list → open a thread: the skeleton matches the thread page's layout — messages column (back link, name + status line, pill, sender line + alternating bubbles, reply box) and the lead-details aside (fit-score ring, details list, "why the score" box) — and the real page lands on top of it without the layout jumping.
- [ ] Dashboard and Meetings each have their own skeleton matching the page (title + status line, four stat tiles, then the activity list beside the channel bars / the six-column table). The real page lands without the layout jumping.
- [ ] Integrations → Connection health is now hourly columns (ok in blue, failures stacked on top in red, 2px gap between them), growing in from the baseline. Hover or tab onto a column: a tooltip with "14–15: 12 ok, 1 failed". Legend "ok / failed" under the chart; a quiet hour is an empty slot.
- [ ] Sidebar → Conversations: the list skeleton matches the list page (title + count, lead-form button, five-column table with a two-line contact cell, pill and right-aligned score). Same for the back link from a thread.
- [ ] Account menu → Manage account: the dialog opens (it is now loaded on demand). Same for the workspace picker's Manage.
- [ ] Phone width: open the burger drawer — the workspace picker inside it works; close it; the desktop picker is unaffected.
- [ ] Agent page: clicking the "Agent is on", "Book meetings" and "Answer calls" labels toggles the RIGHT switch each time (they had duplicate ids).
- [ ] Conversations + Meetings lists still show the org timezone in the "Received"/time column.
- [ ] Email unsubscribe, a Cal.com/Calendly webhook with a bad signature (401), and a replayed webhook (duplicate → 200) all behave as before.
- [ ] Bounce/complaint on an address shared by two contacts revokes email consent for both (now one UPDATE).
- [ ] Knowledge → add a long PDF: ingestion completes (embedding batches now run 4 at a time).
- [ ] Integrations + Agent → Booking: Set/Not set pills and key fields unchanged (shared `keyField`).

Marketing site:
- [ ] Every page renders with the same fonts as before (DM Sans was downloaded but never displayed; body is Geist, headings Fraunces).
- [ ] Theme toggle still works (next-themes used directly).
- [ ] The landing page demos still animate; with "reduce motion" on in the OS they stop.
- [ ] Six removed packages (`@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `shadcn`, `tw-animate-css`, `motion`) — nothing visibly missing.

## Agent status in the shell (2026-10-23)

The agent's on/off state is always visible: `components/agent-status.tsx`, fed by
`lib/agent-on.ts` (one cached read of `org_profiles.enabled` per request, explicitly
scoped to the current org). Both variants link to Workspace → Agent.

- [ ] Desktop: the sidebar has an "Agent: Offline — Manage" row under the theme control, separated by a hairline. With the agent on it reads "Agent: Online" with a blue dot that pulses.
- [ ] Phone width: the status sits LEFT of the avatar in the top bar. Agent on → just a pulsing blue dot (no text). Agent off → a grey dot with "Offline". Tapping it opens Workspace → Agent.
- [ ] Workspace → Agent → flip "Agent is on" → Save: the sidebar row / top-bar dot update right after the "Saved." toast without a reload; the Dashboard status line matches.
- [ ] With "reduce motion" on in the OS the online dot is solid blue, not pulsing.
- [ ] No active org (fresh account before choosing a workspace): no status in the top bar; the sidebar row reads Offline.

## Section switches on the title line (2026-10-23)

`CardHeader` has a `control` slot; the Agent page's three on/off switches now sit on
the section title's line (title left, switch right, hint beneath). `SwitchRow` is gone.

- [ ] Workspace → Agent: "Agent", "Booking" and "Phone calls" each show their switch at the right end of the title line; the explanatory hint runs beneath, full width. No "Agent is on" / "Book meetings" / "Answer calls" rows remain.
- [ ] Clicking a section title toggles its switch (the title is its label); keyboard focus on the switch shows the focus ring.
- [ ] The agent with an incomplete Business profile: the hint ends with "Needs the company name… Business profile first." and saving ON shows the red error under the header; the switch stays where it was.
- [ ] Booking: turning the switch on reveals the tool cards beneath the hint; a validation error on the tool shows in red under the header.
- [ ] Phone calls: with a number set the hint names it ("…answers calls to +1…"); without one it says a number is needed. The "Outside office hours" row is first (no top hairline) under the header.
- [ ] Phone width: title and switch stay on one line; long hints wrap under both.

## Booking: connect under Integrations, choose under Agent (2026-10-23)

Supersedes the Integrations half of "Booking in one place" above. One client → one
booking tool. Tools are CONNECTED under Integrations (one card each: Cal.com, Google
Calendar, Microsoft 365, Calendly); Agent → Booking only offers connected ones.

Workspace → Integrations:
- [ ] Four booking cards. Nothing stored: all "Not connected". Each Manage dialog opens with a reminder line at the top ("Not ready yet: … still needs its API key and event type ID" / "…a connected calendar" / "…scheduling link").
- [ ] Cal.com → Manage: event type ID + API key + webhook secret in ONE form, one Save/Cancel (appear on change). Save a key + numeric ID → toast, card "Connected", reminder turns blue: "Connected. Turn booking on under Agent → Booking". Only a key (or only an ID) → card "Needs setup" + a Needs attention row "Cal.com is half set up: missing its …".
- [ ] Google Calendar → Manage: a "Connect Google Calendar" button (admins only) that goes to the Google consent screen; on return you land on INTEGRATIONS with a toast and the card reads "Connected"; the dialog shows the account email + Disconnect (confirm). Microsoft 365's dialog then says Google is connected and to disconnect it first (one calendar at a time).
- [ ] Calendly → Manage: link + signing key as before; saving a link → "Connected".
- [ ] A connected tool that is also chosen under Agent shows a blue "Booking tool" status and its dialog says "Connected and in use". Chosen Cal.com/Calendly without its signing key → Needs attention "… signing key missing. Bookings won't sync back."
- [ ] Clearing what a chosen tool needs (Disconnect the calendar; Clear the Cal.com API key or blank its event type ID; blank the Calendly link) un-chooses it: Agent → Booking falls back to "Nothing is connected yet" (or the next connected tool) and the agent hands off.

Workspace → Agent → Booking:
- [ ] Nothing connected: the switch is disabled; hint ends "Nothing is connected yet."; a row with "Connect a booking tool" (primary) → Integrations. No tool cards.
- [ ] Exactly one tool connected: switch on → one row "Books through Calendly, https://…" (or "Google Calendar, you@…", "Cal.com, event type 123") with its mark, a one-line how-it-works, and a "Change" link to Integrations. No chooser. Save → toast; Integrations shows that card as "Booking tool".
- [ ] Two or more connected (e.g. Cal.com keys + a Calendly link): a "Books through" chooser listing ONLY those, plus "Manage connections" → Integrations.
- [ ] Google / Microsoft 365 chosen: meeting length + working hours beneath; Cal.com / Calendly: nothing beneath. No Connect / Disconnect / key fields anywhere on the Agent page.
- [ ] Tamper check: submit the form with `tool=google` while Google isn't connected → red "Connect a booking tool under Integrations first." under the header; nothing saved.
- [ ] Turn booking off → Save: cards go back to "Connected" (not "Booking tool"); every connection stays. On again: the same tool is pre-selected.
- [ ] Switch OFF with a tool connected: the row still shows it — "Connected: Calendly, https://…" with "Turn booking on and the agent books through it." and a Manage link. With several connected it names the others ("Also connected: …"). Switch on → the row reads "Books through …" (one tool) or becomes the chooser (several).

## Integrations in sections + CRM/PSA placeholders (2026-10-23)

- [ ] Workspace → Integrations: below the health / attention pair, three sections in order — **Booking** (Cal.com, Google Calendar, Microsoft 365, Calendly), **Communication** (Twilio, Resend, Slack), **CRM and PSA** (HaloPSA, ConnectWise, Zoho CRM, HubSpot). Each has a title and a one-line hint.
- [ ] The four CRM/PSA cards read "Coming soon" (grey dot) and have no Manage button. HubSpot and Zoho show their real marks; HaloPSA and ConnectWise show lettered tiles ("H" teal, "CW" navy) until real logos land.
- [ ] Nothing about the Booking or Communication cards changed (statuses, Manage dialogs, Needs attention).
- [ ] Phone width: sections stack; cards go one per row.
