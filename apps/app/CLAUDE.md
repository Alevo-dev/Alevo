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
7. **Verify every webhook.** Signature-verify (svix for Clerk/Resend via
   `lib/webhooks/verify.ts`; HMAC compares through `lib/crypto/safe-equal.ts`);
   handlers are idempotent on the provider event id via `webhook_events` —
   `claimWebhookEvent()` first-writer-wins, `releaseWebhookEvent()` on a processing
   failure so the provider's retry reprocesses. Provider routes are wrapped in
   `trackDeliveries()` (feeds the Integrations health card).
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
14. **Newest release of every package.** No deprecated / EOL deps — each pinned to
    its current major and kept current. On a new major, read the upgrade guide,
    migrate, and verify (typecheck + build); don't stay on the old line.

## UI (design system)

The app renders on the **Alevo design system** from Claude Design (plan.md §10):
dark navy default, brand blue for the one primary action / active nav / live state,
violet for outbound and AI-drafted things, green/amber/red for status only.

- **Tokens:** the `--ds-*` block in `packages/tokens/tokens.css` (light + `.dark`).
  `app/globals.css` maps them into Tailwind — use `bg-canvas` / `bg-surface` /
  `bg-raised`, `border-hairline` (dividers) / `border-control` (inputs), `text-ink` /
  `text-ink-muted`, `bg-brand` + `text-on-brand` (never white on brand), `bg-violet`,
  `text-success|warning|danger`, `text-title|heading|metric|label`, `font-display|mono`.
  There are no shadcn alias colours (`bg-background`, `text-muted-foreground`, …)
  any more — only the design-system names above. No raw hex in components.
- **Primitives** (`components/ui/`): `Button`/`buttonClass` (primary · accent ·
  secondary · ghost · danger; sm/md), `Card`/`CardHeader`, `Field`/`Input`/`Textarea`/
  `Select`/`FieldError` (red border + message beneath — rule 13), `SettingRow`
  (label-left/control-right), `Switch` (a section's on/off switch goes in
  `CardHeader`'s `control` slot, on the title line — never as a row beneath it),
  `Pill`/`StatusDot`, `StatTile`,
  `PageHeader`, `Table`/`Th`/`Tr`/`Td`/`EmptyRow`, `Notice`. Compose these; don't
  hand-roll class strings on pages.
- **No browser-default controls.** Never a native `<select>`, `alert()`, `confirm()` or
  default validation popup. Dropdowns are `Select` (`components/ui/select.tsx`); modals are
  `Dialog`; every destructive action (delete, cancel, remove, revoke, clear, disconnect) goes
  through `ConfirmSubmit` / `ConfirmDialog`; edits such as reschedule open a `Dialog` with a
  Save button.
- **In-flight buttons:** every submit / confirm / OAuth button passes `loading={pending}` to
  `Button` (spinner + disabled + `aria-busy`), never a bare `disabled`. Cancel/Discard
  buttons beside them just `disabled`. Button-styled labels use `<Spinner />`.
- **Feedback:** successes are toasts (Sonner via `components/app-toaster.tsx`, on the
  tokens; 4s, closable). After a server action use `useActionToast(state, "Saved.")`
  (`lib/ui/use-action-toast.ts`) — it toasts once per dispatch and refreshes. Errors are
  never toasts: per-field under the control, form-level next to the submit (rule 13).
- **Charts animate on load.** Numbers: `StatTile` with a numeric `value` (or `CountUp`)
  counts up. Bars: `animate-grow-x` / `animate-grow-y` (stagger with `animationDelay`).
  SVG lines: `pathLength="1"` + `animate-draw`. Lists/feeds: `animate-rise`. All of them
  respect `prefers-reduced-motion`. Any new graph on the dashboard uses these.
- **Page transitions:** `components/page-transition.tsx` (React `ViewTransition`) via `(app)/template.tsx` + `workspace/template.tsx`
  (fade + rise by default). Tag list→detail links `transitionTypes={["nav-forward"]}` and
  back links `["nav-back"]` to slide; CSS is in globals.css under "View transitions".
- **Auth screens** (`(auth)/`): custom UI over Clerk **v7's signals ("Future") API**,
  not the hosted `<SignIn/>`: `components/auth/*` — tabs switch views in place
  (URL updated via `history.replaceState`), email-code verification, forgot-password reset,
  Google OAuth via `/sign-(in|up)/sso-callback` (`AuthenticateWithRedirectCallback`). Sign-up
  creates the org from the Company field.
  - **v7 signals (not v6):** `useSignIn()` / `useSignUp()` return
    `{ signIn|signUp, errors, fetchStatus }` (no `isLoaded`/`setActive`). Sign-in is
    `signIn.password({ identifier, password })` then `signIn.finalize()`; sign-up is
    `signUp.create({...})` → `signUp.verifications.sendEmailCode()` →
    `verifyEmailCode({ code })` → `signUp.finalize()`; reset is
    `signIn.resetPasswordEmailCode.sendCode()/verifyCode()/submitPassword()`; Google is
    `signIn.sso()/signUp.sso({ strategy:"oauth_google", redirectUrl, redirectCallbackUrl })`.
    Methods **return `{ error }`** (no throw) and field/global messages come off the reactive
    `errors` signal (`errors.fields.identifier|emailAddress|password|code|legalAccepted`,
    `errors.global[0]`) — forms read those directly and keep a little local state only for
    empty-field checks. `toFormErrors` (`clerk-errors.ts`) is only for the throwing
    `user.*` calls in the account dialog.
  - **Already-signed-in guard:** the `/sign-in` + `/sign-up` pages redirect an **active**
    session to `/dashboard` server-side (`auth()`, `userId && sessionStatus !== "pending"`
    — zero flash), skipped when an invite ticket is present. `AuthScreen` also has a client
    guard (`clerk.session` → `nextPathAfterAuth`) for **pending** (org-not-chosen) sessions,
    which the server treats as signed-out.
  - The Clerk instance **forces organization selection**: new sessions are *pending* with a
    `choose-organization` task (pending = signed out for `auth.protect()`), so every flow
    routes through `nextPathAfterAuth` → `/onboarding/choose-organization`
    (`components/auth/choose-organization.tsx`, registered as `taskUrls`, public in proxy).
- **Workspace (not "Settings"):** the org's setup lives under `/workspace/*` — Business
  profile (`profile/`: company, offering, ICP, criteria, disqualifiers, voice →
  `saveBusinessProfile`), Agent (`agent/`: on/off, follow-up, SMS number →
  `saveAgentSettings`; **Booking** = one switch + the CONNECTED tool the agent books
  through, with only its behaviour settings beneath → `booking-actions.ts`; **Phone
  calls** → `voice-actions.ts`; enabling the agent requires the profile's three
  required fields), Knowledge, Integrations (three sections — **Booking**: Cal.com,
  Google Calendar, Microsoft 365, Calendly; **Communication**: Twilio, Resend, Slack;
  **CRM and PSA**: HaloPSA, ConnectWise, Zoho CRM, HubSpot as "Coming soon"
  placeholders until Sprint 5 write-back. A section shows cards ONLY for tools that
  are connected or at least started (`ServiceView.listed`), else "Nothing connected
  yet."; everything else waits in the **Connect a tool** picker (`connect-tool.tsx`:
  same sections, a Connect button per row that closes the picker and opens that
  tool's settings dialog — the same panel its card's Manage would show). Sections +
  placeholders live in `lib/integrations/services.ts` (`SERVICE_GROUPS`,
  `CRM_PLACEHOLDERS`); marks in `lib/integrations/brand-icons.ts` — `LETTER_MARKS` is
  the lettered-tile fallback for brands Simple Icons doesn't carry). (No Files tab: the `files` table is a storage ledger behind the
  Knowledge PDF upload; deleting a KB document deletes its R2 object + ledger row + chunks.) "Settings" is reserved for per-user app preferences.
  `/settings/*` redirects (next.config.ts).
- **Manage workspace dialog:** the workspace picker (`components/workspace-switcher.tsx`)
  has a **Manage** item opening `components/workspace/organization-dialog.tsx` — a two-pane
  modal (mirrors the account dialog) with **General** (`general-tab.tsx`: org name/logo via
  Clerk `organization.update`/`setLogo` — mirrored by the `organization.updated` webhook —
  plus Leave / Delete) and **Members** (`members-tab.tsx`: load via the `loadMembers` server
  action, search, Members/Invitations sub-tabs, invite + role/remove/revoke reusing
  `workspace/members/actions.ts`). Leave/Delete run through guarded server actions
  (`workspace/org-actions.ts` → `leaveActiveOrg`/`deleteActiveOrg`) that sync our DB (delete
  cascades on the org row, since `organization.deleted` has no webhook). The old
  `/workspace/members` page now redirects to `/workspace/profile`.
- **Labels:** `lib/ui/status.ts` maps every enum to a sentence-case label + tone
  (`CONVERSATION_STATUS`, `MEETING_STATUS`, `KB_STATUS`, `CHANNEL_LABEL`, …). Never
  render a raw enum value. Shared formatters live in `lib/format.ts`.
- **Shell:** `(app)/layout.tsx` + `components/app-sidebar.tsx` (232px rail, plan card,
  Clerk controls); Settings pages share `(app)/workspace/layout.tsx` + `settings-tabs.tsx`.
  The agent's on/off state is always in the shell (`components/agent-status.tsx`, read once
  per request via `lib/agent-on.ts`): a row under the theme control on desktop, a dot left of
  the avatar on phones (pulsing dot = online; dot + "Offline" = off). Both link to Agent.
- **Icons:** `lucide-react`, 1.75 stroke, 16px in dense UI. Voice: operator reporting
  in — plain verbs, sentence case, no exclamation marks or emoji.

## Data + auth seams

- **`@alevo/db`** — Drizzle over `postgres-js` through the Supavisor transaction
  pooler (`prepare: false`).
  - `withTenant(claims, fn)` — RLS-enforced: opens a tx, injects
    `request.jwt.claims` with `SET LOCAL`, downgrades to role `authenticated`.
  - `withService(fn)` — RLS **bypass** (connection owner) for webhooks/Inngest.
    No safety net: scope every write by our ids in code. Server-only.
- **`@alevo/auth`** — `withOrg(fn)` wraps `withTenant` with the verified Clerk
  session. Use it for all tenant reads/writes in server components/actions.
  `getCurrentUser`, `getCurrentOrg`, `requireRole`'s role lookup and
  `lib/org-timezone.ts` are wrapped in React `cache()`: call them wherever needed
  (layout, page, action) — each runs once per request.
- **Public origin:** `lib/app-url.ts` — `appUrl()` (`NEXT_PUBLIC_APP_URL`, dev
  fallback `:3001`) and `requestOrigin(req)` (forwarded headers). Never inline the
  fallback again (the OAuth files once disagreed on the port).
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
- **0006** `files` (R2 object key + metadata; tenant-scoped reads). Bucket layout:
  `organizations/{orgId}/{files|knowledge|images|avatars|logos}/{uuid}-{name}` —
  `lib/files/keys.ts`; the presign route takes `purpose`. A KB PDF is one object with a
  `files` row (ledger) and a `kb_documents` row (indexed source).
- **0007** CRM core: `contacts`, `conversations`, `messages`, `consents` (+ the
  `channel` / `conversation_status` / `message_direction` / `message_author`
  enums). The hosted lead form writes via the service path; tenant users work
  leads via RLS. `recordUsage()` meters inbound conversations (rule 11).
- **0008** `org_profiles` (one row/org): the Qualifier's per-org context (company
  offering, ICP, qualifying criteria, disqualifiers, tone, signoff, `enabled`).
  Edited by admins in Workspace → Agent; read by the Qualifier via the
  service path.
- **0009** cadence send windows: `org_profiles.timezone` +
  `send_window_start_hour`/`send_window_end_hour` (daily window for follow-up
  nudges, CHECK-guarded) and `contacts.timezone` (best-effort, from the lead
  form's browser tz; preferred over the org default). Additive — no RLS change.
- **0010** knowledge base: `kb_documents` + `kb_chunks` (pgvector `vector(1024)`,
  hnsw cosine index) + the `kb_source_type` / `kb_doc_status` enums. Tenant-scoped.
- **0011** `email_suppressions` (one row/(org,email); `unsubscribe`/`bounce`/
  `complaint`). Checked before every outbound email.
- **0012** `org_profiles.sms_from_number` (the org's Twilio number, unique where
  set). Outbound SMS sends from it; inbound SMS routes to the org by it.
- **0013** booking: `meetings` (provider / `provider_ref` / status / start/end /
  join_url; tenant-scoped, unique `provider_ref` per org for webhook idempotency)
  + the `booking_provider` / `meeting_status` enums, and
  `org_profiles.calcom_event_type_id`.
- **0014** `meetings.outcome` (`meeting_outcome` enum: pending/showed/no_show) +
  `meetings.converted` — the rep-marked post-meeting result (feeds §11 KPIs).
- **0015** `org_profiles.calendly_url` + `calendly` added to `booking_provider`
  — Calendly link mode.
- **0016** direct calendar booking: `org_profiles.calendar_provider`
  (`google`/`m365`) + `calendar_id` + `calendar_account_email` +
  `booking_length_min` / `booking_hours_start` / `booking_hours_end`. OAuth
  refresh tokens live in `org_secrets`, not here.
- **0017** `webhook_deliveries` (one row per inbound provider webhook, `ok`/`failed`;
  feeds the Integrations "Connection health" card; written via `trackDeliveries`).
- **0018** inbound voice: `calls` (one row per Vapi call: transcript, summary,
  recording key, outcome) + `org_profiles.voice_enabled` / `voice_after_hours` /
  `vapi_assistant_id` / `vapi_phone_number_id`.
- **0019** `org_profiles.booking_tool` — the ONE chosen booking tool (null = off),
  backfilled from the old precedence. See Booking below.

## The Qualifier (Claude agent)

The AI SDR that works inbound leads. On each inbound message the hosted form /
tester emits `conversation/message.received`; the Inngest function
`qualify-conversation` (rule 9/10, per-org concurrency, `retries: 1`) loads the
org profile + thread and runs the agent. After the agent replies and the lead is
still active, it arms the follow-up cadence (see Durable workflows below).

- **Engine:** `lib/qualifier/` — `prompt.ts` (system prompt from the org
  profile), `tools.ts` (tool defs + DB dispatch), `run.ts` (context loader + a
  **manual** tool-use loop so every tool call is gated/recorded, not the SDK
  auto-runner). Model **`claude-sonnet-5`**, adaptive thinking, effort `medium`.
  Anthropic code lives only here — read the `claude-api` skill before touching it.
- **Booking is the goal, on every channel.** The Qualifier (email / SMS / chat), the
  cadence nudges and the voice agent all push a qualified lead toward a meeting
  without being asked: once the criteria check out (typically fit >= 60) the agent
  asks to put a call on the calendar and OFFERS TIMES in the same turn. The offer
  comes from `lib/booking/offer.ts` (`offerSlots`: a few slots spread over the next
  24-72 hours with 2h notice, widening to a week if that window is full;
  `formatSlot` written vs. spoken) — both `check_availability` tools use it. Calendly
  mode sends the link in the same turn; no calendar at all → promise a callback
  within a business day and hand off. The prompts, the tool descriptions and the
  nudge directive all say this; keep them in step if you change one.
- **Tools (MVP):** `reply_to_contact`, `record_fit_score`, `set_status`
  (`active`/`disqualified`/`handed_off`), `escalate_to_human` (→ Slack). When
  booking is connected (see below), the Qualifier can reach the **`booked`**
  end-state — either the API tools (`check_availability` + `book_meeting`, Cal.com)
  or the link tool (`send_booking_link`, Calendly), per the org's `bookingMode`.
  All writes go through `withService`, scoped to the org **in code** (Inngest has
  no session → no RLS). PSA write-back tools come in Sprint 5.
- **Testing before email/SMS exist:** the conversation thread has a "reply as
  contact" box (`[id]/actions.ts` + `reply-ui.tsx`) that posts an inbound message
  and fires the event, so the full loop is exercisable end-to-end.
- **Retry caveat:** the agent writes replies mid-run, so it is intentionally NOT
  wrapped in `step.run` (memoization would replay writes). `retries: 1` bounds
  duplicate-reply risk until idempotency keys land; the Anthropic SDK retries
  transient API errors in-process.

## Email channel (Resend)

The first real inbound/outbound channel. `lib/email/resend.ts` is the only
importer of the `resend` SDK.

- **Outbound:** the Qualifier's `reply_to_contact` emails the lead when the
  contact has an email and email is configured (`isEmailConfigured()`), else it
  records the reply in-app (dev fallback). Sent from one Alevo-verified address
  (`EMAIL_FROM_ADDRESS`) with the org's name as the display name — per-tenant
  sending domains come later. Delivery failure is logged (Sentry) but never
  fails the agent turn; the message is still recorded.
- **Inbound:** replies thread back via a per-conversation `Reply-To`
  (`reply+<conversationId>@INBOUND_EMAIL_DOMAIN`). Resend's `email.received`
  webhook → **`/api/webhooks/resend`** (svix-verified like Clerk; idempotent on
  the received `email_id` via `webhook_events`). The webhook is metadata-only, so
  the body is fetched by id (`emails.receiving.get`); we match the conversation
  from the `reply+<id>` address, record an inbound `email` message (dedup on
  `messages.provider_ref` = the RFC `Message-ID`), and fire
  `conversation/message.received` — the same event the form and tester fire.
- **Threading:** outbound sets `In-Reply-To`/`References` to the last inbound
  `Message-ID` (stored as `provider_ref`). Our matching is by the `reply+<id>`
  address, not headers.
- **Compliance:** every send carries `List-Unsubscribe` + `List-Unsubscribe-Post`
  (RFC 8058 one-click → `/api/unsubscribe?t=<signed token>`, public) and `org_id`
  / `conversation_id` tags. `email.bounced` / `email.complained` webhooks →
  `addSuppression` (org from the tag, else a unique contact-email match). The
  Qualifier calls `isSuppressed()` before emailing and skips suppressed addresses.
  Suppression token is an HMAC over {org,email} with `SECRETS_MASTER_KEY`.
- **Setup (dashboard):** verify a sending domain; add a receiving domain
  (MX → Resend) or use the `<id>.resend.app` subdomain; create a "received mail"
  webhook pointing at `/api/webhooks/resend`; set `RESEND_API_KEY`,
  `EMAIL_FROM_ADDRESS`, `INBOUND_EMAIL_DOMAIN`, `RESEND_WEBHOOK_SECRET`.
- **Local testing:** outbound send works in dev directly (it's an outbound API
  call). For inbound, either use the conversation thread's "reply as contact"
  tester (no Resend needed — fires the same event), or add a **second** Resend
  webhook endpoint pointing at your static ngrok URL `/api/webhooks/resend` with
  **its own** signing secret in `.env.local` (prod's secret stays in Vercel).
  Resend fans `email.received` out to every subscribed endpoint, so prod and dev
  both receive each reply — the `reply+<conversationId>` id routes it: each env
  only processes conversations in its own DB and 200-ignores the rest. Run
  `npx inngest-cli dev` so the fired event is processed.

## SMS channel (Twilio)

Mirrors the email channel. `lib/sms/twilio.ts` is the only importer of Twilio
(raw HTTP, no SDK). Platform creds (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`);
each org sets its own number in Workspace → Agent (`org_profiles.sms_from_number`).

- **Outbound:** the Qualifier's `reply_to_contact` texts the lead when the
  **conversation channel is `sms`** and the contact has a phone + the org has a
  number + Twilio is configured — otherwise it falls through to email, then
  in-app. A `21610` (recipient sent STOP) is treated as opted-out, not an error.
- **Inbound:** Twilio posts form-encoded to **`/api/webhooks/twilio`** (verified
  via `X-Twilio-Signature` — HMAC-SHA1 over the **public** URL rebuilt from
  forwarded headers + sorted params). Routed to the org by the `To` number;
  contact matched/created by `From` phone; attaches to the latest open `sms`
  conversation or opens one; records an inbound `sms` message (idempotent on
  `provider_ref` = `MessageSid`); meters a brand-new conversation; fires
  `conversation/message.received`. STOP/UNSUBSCRIBE keywords are not engaged
  (Twilio enforces carrier opt-out). The webhook always returns empty TwiML — we
  reply async via the API.
- **Setup (dashboard):** buy/assign a Twilio number per org; set it in Settings →
  Qualifier; point the number's inbound "A message comes in" webhook at
  `/api/webhooks/twilio` (POST); set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
  (Per-tenant subaccounts + A2P 10DLC per plan.md Sprint 0 — MVP uses one account
  with a per-org number.)

## Inbound voice (Vapi)

The same agent answers calls on the org's Twilio number. `lib/voice/`: `vapi.ts` (raw
REST client, the only Vapi importer), `assistant.ts` (assistant body from the
profile), `prompt.ts` (greeting + system prompt per mode), `schedule.ts` (mode +
timezone), `tools.ts` (tool dispatch), `contact.ts`, `process-call.ts`. Verified
against a live call on 2026-10-26.

- **Routing is per call.** The Twilio number is imported into Vapi with OUR server URL
  (`/api/webhooks/vapi` + the `x-alevo-secret` header) and **no assistant attached**, so
  Vapi sends `assistant-request` on every call and the webhook answers with the assistant
  for the current mode (open / after hours / closed). `assistant-request` is NOT a valid
  assistant-level `serverMessages` entry (Vapi 400s) — the assistant lists only
  `tool-calls` + `end-of-call-report`. Turning calls off needs no Vapi call. The saved
  assistant (`vapi_assistant_id`) exists to validate the body at Save and to show in
  Vapi's dashboard; calls don't use it directly.
- **Mode** = `voiceModeNow(profile)`: weekdays within the booking hours in the org's
  timezone, via `profileTimeZone` (falls back to `DEFAULT_TIMEZONE`, never UTC — a null
  timezone once made 3pm Ottawa read as 7pm UTC = "closed").
- **Booking after hours too.** `bookingOnCall(mode, afterHoursStyle, bookingConnected)`:
  open calls always; after hours when the org takes details (not plain voicemail). The
  greeting says the office is closed, then the agent qualifies and offers times anyway.
- **Who called:** `save_contact_details` (`lib/contact-details.ts`, shared with the
  Qualifier) writes name / email / company onto the contact as soon as the agent learns
  them; `take_message` and `book_meeting` save the name too. Conversations fall back to
  the phone number when there is no name or email. Transcriber is Deepgram nova-3; the
  prompt tells the agent to ask for a spelling once rather than loop on a name.
- **Sounding human:** Vapi speaks a stock filler at the start of every synchronous tool
  call unless the tool has its own `request-start` message. Bookkeeping tools
  (`save_contact_details`, `record_fit_score`, `set_status`) run `async` (silent); the rest
  carry one natural line ("give me a few seconds while I get that booked"). The prompt
  wraps up with "anything else I can help with?" → thanks → `endCall`
  (`endCallFunctionEnabled: true`): the agent hangs up, never the caller.
- **After the call:** `end-of-call-report` → Inngest `process-voice-call`: the recording
  step may fail (it is caught → `recordingKey: null`) but the call row, thread summary,
  minutes and Slack alert are always written. `putObject` sends `content-length` (R2
  answers 411 to chunked uploads).

## Booking (Cal.com + Calendly + Google/M365)

Lets the Qualifier book meetings instead of only handing off. The org picks ONE
tool (`org_profiles.booking_tool`, migration 0019; null = booking off) and the
context loader computes **`bookingMode`** from it: **`calcom`** (needs key + event
type), **`google`** / **`m365`** (needs that calendar connected — refresh token +
`calendar_id`), **`calendly`** (needs a Calendly URL), else `null` (hand off). A
chosen tool that isn't configured yet also yields `null` — there is no longer any
precedence over whichever fields happen to be filled in. Cal.com, Google, and M365 are all *API booking* and share
the same tools (`check_availability` + `book_meeting`); Calendly is *link mode*
(`send_booking_link`). `lib/booking/` is a provider-agnostic adapter
(`BookingAdapter`: `availableSlots` + `book` + `cancel` + `reschedule`), resolved
by `getBookingAdapter(orgId, bookingConfigFromProfile(profile))`.

- **Connect vs. behave (two places, by design):** every tool is *connected* under
  **Workspace → Integrations** (its Manage dialog holds everything that makes it
  usable — Cal.com: event type ID + API key + webhook secret (`calcom-form.tsx`);
  Google / Microsoft 365: Connect (a link into the OAuth start route) + Disconnect
  (`calendar-connect.tsx`; the callback returns to Integrations); Calendly: link +
  signing key (`calendly-form.tsx`)). Each dialog opens with a `SetupStatus`
  reminder: not ready (what's missing) / connected but not chosen / in use.
  `lib/booking/connected.ts` is the one definition of "connected"
  (`bookingToolMissing`, `connectedBookingTools`); the service cards, the Needs
  attention list and Booking all derive from it.
  **Workspace → Agent → Booking** (`booking-ui.tsx` / `booking-actions.ts`) is
  behaviour only: a switch (disabled, with a "Connect a booking tool" link, while
  nothing is connected), the connected tool the agent books through (auto-picked
  when exactly one is connected; a chooser among connected ones otherwise), and
  that tool's booking settings beneath (meeting length + working hours for
  Google / M365; nothing for Cal.com / Calendly). The save re-derives the
  connected set server-side and rejects anything else. Disconnecting a calendar,
  clearing the Cal.com key / event type, or clearing the Calendly link un-chooses
  that tool (`unchooseBookingTool`). Turning booking off clears only the choice.
- **Book (Cal.com):** `check_availability` → `GET /v2/slots`
  (`cal-api-version: 2024-09-04`); `book_meeting` → `POST /v2/bookings`
  (`cal-api-version: 2026-02-25`) with `metadata.alevoOrgId`/`alevoConversationId`.
  On success it records a `meetings` row (`provider_ref` = booking uid, `provider`
  = the adapter's) and sets the conversation to `booked` (terminal → the Qualifier
  won't re-run and the cadence stops).
- **Book (Google / M365 — OAuth direct):** `lib/booking/oauth.ts` runs the
  consent flow (`/api/oauth/{google,microsoft}/start` → `…/callback` — the callback is
  public in `proxy.ts` and returns to the origin the start leg ran on; CSRF via a
  signed `state`); only the **refresh token** is stored (encrypted, in
  `org_secrets` as `{google,m365}_calendar_refresh_token`), exchanged for a
  short-lived access token per adapter build. `availableSlots` reads free/busy
  (Google `POST /freeBusy`; Graph `POST /me/calendar/getSchedule`) and
  `lib/booking/slots.ts` turns busy intervals into slots by simple rules
  (weekday working-hours window + fixed length, tz-aware, no past). `book`
  re-checks the slot (double-booking guard) then creates the event with a video
  link (Google Meet via `conferenceData`; Teams via `isOnlineMeeting`),
  recording the `meetings` row the same way. **No webhook** — contact-initiated
  changes on these calendars don't sync back (basic, single-calendar by design).
  Deliberately not built: round-robin, buffers, notice rules (→ Cal.com).
- **Calendly (link mode):** `send_booking_link` sends the org's `calendly_url`
  (with `utm_source=alevo` + `utm_content=<conversationId>` appended) for the lead
  to self-book — no slot/booking API. When the lead books, Calendly's
  **`invitee.created`** webhook records the `meetings` row (`provider = calendly`)
  and flips the conversation to `booked`; **`invitee.canceled`** cancels the row
  and reopens the conversation. Reschedule/cancel are handled by Calendly's own
  links (the contact self-serves) — our Meetings tab doesn't expose them.
- **Webhook:** `/api/webhooks/calcom` — `x-cal-signature-256` = HMAC-SHA256 over
  the raw body with the org's `calcom_webhook_secret` (verified when set).
  `BOOKING_CREATED/RESCHEDULED/CANCELLED` sync `meetings` + conversation status;
  idempotent per `(event, uid)` via `webhook_events`; cancel reopens the
  conversation. `/api/webhooks/calendly` — `Calendly-Webhook-Signature`
  (`t=<ts>,v1=<sig>`) = HMAC-SHA256 over `<ts>.<rawBody>` with the org's
  `calendly_webhook_secret`; idempotent per `(event, invitee uri)`.
- **Surfaced:** the **Meetings** tab (`/meetings`) lists bookings and lets reps
  set the **outcome** (showed / no-show / converted — feeds the §11 KPIs) and
  **cancel / reschedule** for API-managed providers (Cal.com / Google / M365, via
  the adapter's `cancel`/`reschedule`, then our row syncs). Calendly / manual rows
  show outcome + converted only. The conversation thread shows the booked meeting
  inline.
- **Env (platform-level OAuth apps):** `GOOGLE_OAUTH_CLIENT_ID` /
  `GOOGLE_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_CLIENT_ID` /
  `MICROSOFT_OAUTH_CLIENT_SECRET` (+ optional `MICROSOFT_OAUTH_TENANT`, default
  `common`); redirect URIs are `${NEXT_PUBLIC_APP_URL}/api/oauth/{google,
  microsoft}/callback`. Google scopes are `calendar.events` + `calendar.freebusy`
  (least privilege; both sensitive) and need app verification before
  external tenants connect without warnings (plan.md Sprint 3 note — submit early).
- **Deferred:** contact-initiated reschedule *through the Qualifier* (contacts
  can already self-serve via Cal.com/Calendly invite links, synced by our
  webhooks), and push-notification sync for Google/M365 calendar changes.

## Consent (compliance)

Consent is data, not a checkbox (plan.md rule 8). The `consents` table (0007)
records one active row per (contact, channel); `@alevo/db` exposes `recordConsent`
/ `revokeConsentForContact` / `revokeConsentForEmail`.

- **Captured** on every inbound touch: hosted form (lead action), email reply
  (`/api/webhooks/resend`), SMS inbound (`/api/webhooks/twilio`). `recordConsent`
  is idempotent — one active consent per channel.
- **Revoked** on opt-out: email unsubscribe (`/api/unsubscribe`) + bounce /
  complaint (resend webhook) → `revokeConsentForEmail`; SMS STOP (twilio webhook)
  → `revokeConsentForContact`. Revocation sets `revoked_at`; the email suppression
  list is the separate hard-enforcement layer the Qualifier checks before sending.

## Knowledge base (RAG)

Grounds the Qualifier in each org's own material. `lib/kb/` owns it;
`lib/email/resend.ts`-style config guards keep it optional.

- **Ingest:** admins add Text / URL / PDF in **Workspace → Knowledge**. A row is
  created `pending` and `kb/document.ingest` fires → the `ingest-kb-document`
  Inngest function (stepless, idempotent delete-then-insert, per-org concurrency)
  extracts (`lib/kb/extract.ts`: raw text / URL HTML-strip / PDF via `unpdf` from
  an R2 presigned-GET) → chunks (`chunk.ts`, ~1500 chars w/ overlap) → embeds
  (`embeddings.ts`, **Voyage `voyage-3.5-lite`, 1024-dim**, raw HTTP) → stores
  `kb_chunks`, sets `ready`/`failed`. PDFs reuse the files presign route for upload.
- **Retrieve:** `retrieve.ts` embeds the latest inbound message as a query and
  pulls top-k chunks by cosine similarity (drizzle `cosineDistance`, hnsw index),
  injected into the Qualifier's system prompt. Best-effort: no `VOYAGE_API_KEY`,
  no KB, or any failure → the Qualifier proceeds ungrounded.
- **Env:** `VOYAGE_API_KEY`. Embedding dim (1024) is baked into the migration —
  changing the model/dim means a new migration + re-embed.

Sprint 2 is channel-complete (form, email, SMS); Sprint 3 Slice 1 adds Cal.com
booking (above). Coming next: consent capture + meeting outcomes, Google/M365
booking (Sprint 3), and PSA write-back (Sprint 5).

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

**Conversation cadence (`lib/cadence/`).** Two functions drive a conversation:
- `qualify-conversation` reacts to `conversation/message.received` (debounced
  per conversation; `priority` marks inbound as high). It runs the agent, and if
  the agent replied and the lead is still active it fires
  `conversation/awaiting-reply`. It is deliberately **stepless** (see the agent
  retry caveat above).
- `conversation-cadence` reacts to `conversation/awaiting-reply` and follows up a
  quiet lead on a schedule (`schedule.ts`: +1d, +3d, +3d, then disqualify;
  `CADENCE_FAST=1` shrinks the gaps to seconds for local testing). It
  `cancelOn` a new inbound message (the reply re-arms a fresh cadence) and is a
  `singleton` per conversation. Each nudge runs the Qualifier with a follow-up
  **directive** (not a contact message) and is wrapped in `step.run` — unlike the
  main qualify run — because this function has later `sleep` steps, so non-step
  code would re-fire the nudge on every replay. Nudges are proactive outbound, so
  each is gated to the org's **send window** in the contact's timezone
  (`send-window.ts`, pure `Intl`, DST-correct) via a durable `sleepUntil`.
  Immediate replies to a fresh inbound are never gated (speed-to-lead).
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
pnpm --filter @alevo/app dev                 # app on :3001 (web :3000, admin :3002)
```

In `apps/app/.env.local` (copy from `.env.example`):
- `DATABASE_URL` → the project's **Transaction pooler** string (port 6543, `?pgbouncer=true`).
- `DIRECT_URL` → the project's **Session pooler** string (port 5432).
- Clerk keys + `CLERK_WEBHOOK_SIGNING_SECRET`.

`db push` does not run `seed.sql`; run the platform-admin bootstrap manually in
the Supabase SQL editor after your first sign-in. For local Clerk webhooks,
tunnel `:3001` with ngrok and point the Clerk webhook at `/api/webhooks/clerk`.
(See the repo-root [`DEVELOPMENT.md`](../../DEVELOPMENT.md) for the full dev runbook.)

> Docker alternative (if WSL2 is ever available): `supabase start` + `supabase
> db reset` give the full local stack on `:54322` and run `seed.sql`.

## Observability

Sentry is wired (`instrumentation.ts`, `sentry.*.config.ts`,
`instrumentation-client.ts`) and is a no-op until `NEXT_PUBLIC_SENTRY_DSN` is
set. Source-map upload (withSentryConfig) is intentionally not enabled yet.
