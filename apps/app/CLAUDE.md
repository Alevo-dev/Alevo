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
  (label-left/control-right; `end` pushes a switch to the row's right edge, used by Agent → Notifications → Email the team), `Switch` (a section's on/off switch goes in
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
- **Save buttons (2026-11-16):** outside a dialog, every Save is the shared bottom `SaveBar` (`@alevo/ui/save-bar`: "Unsaved changes", Discard, Save changes; shown only while something changed; inside the `<form>`). Dialogs keep their own footer Save. Every such form also arms the leave guard (`@alevo/ui/unsaved-changes`: `useLeaveGuard` + `LeaveDialog` with Stay / Discard and leave / **Save and leave**, the last through `useSaveAndLeave`, which submits the form and navigates once the action reports `ok`). Used by Agent, Profile, Brand (one form for tone, sign-off and both colours: `settings/tone-card.tsx` + `save-all.ts`), Manage → General and, in the admin console, Internal alerts and an organization's Plan.
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
  calls**, **Voice** and **Outside office hours** sit in the Channels card under the SMS number and save with the same Save (`lib/voice/apply.ts` runs after the rest is saved);
  enabling the agent requires the profile's three
  required fields), Knowledge, Integrations (three sections — **Booking**: Cal.com,
  Google Calendar, Microsoft 365, Calendly; **Communication**: Twilio, Resend, Slack;
  **CRM and PSA**: HaloPSA, Autotask, Zendesk, ConnectWise, Zoho CRM, HubSpot as "Coming soon"
  placeholders (Lead capture also has Facebook Lead Ads, Webhook and Custom API as "Soon" picker entries: `CAPTURE_PLACEHOLDERS`, no dialog) until Sprint 5 write-back. A section shows cards ONLY for tools that
  are connected or at least started (`ServiceView.listed`), else "Nothing connected
  yet."; everything else waits in the **Connect a tool** picker (`connect-tool.tsx`:
  same sections, a Connect button per row that closes the picker and opens that
  tool's settings dialog — the same panel its card's Manage would show). Sections +
  placeholders live in `lib/integrations/services.ts` (`SERVICE_GROUPS`,
  `CRM_PLACEHOLDERS`); marks in `lib/integrations/brand-icons.ts` — `LETTER_MARKS` is
  the lettered-tile fallback for brands Simple Icons doesn't carry). (No Files tab: the `files` table is a storage ledger behind the
  Knowledge PDF upload; deleting a KB document deletes its R2 object + ledger row + chunks.) "Preferences" (`/preferences`, the sidebar bottom: appearance + plan) is the per-user page; the workspace brand page is "Brand".
  `/settings/*` redirects (next.config.ts).
- **Workspace sub-menu:** the Workspace pages (Profile, Agent, Knowledge, Integrations, Manage, Brand) are a sub-menu under "Workspace" in the side nav (`components/workspace-subnav.tsx`, `WORKSPACE_PAGES`; shown while you are in `/workspace`, also in the phone menu). There is no tab bar on the pages. Add a new Workspace page to `WORKSPACE_PAGES`.
- **Workspace → Brand** (`/workspace/settings`, the route keeps its path), admins and owners): page title row with Discard and Save in the header (shown only once the Tone form changed; they submit it via `form=`), then dense panels (`PanelRow`): the **Tone and sign-off** card (`tone-card.tsx`, its own form + `saveToneAndSignoff`; the Profile form and the website import no longer touch `tone` / `signoff`) and the **Brand colour** card (`brand-colour.tsx`: swatches only, never a button-shaped preview, a gear opens the dialog; `saveBrandColour` stays in `integrations/actions.ts`). Not the same as Preferences (`/preferences`: theme + plan).
- **Manage tab** (`/workspace/manage`, the last Workspace tab; the workspace picker has no Manage item any more): title row, 920px of dense panels (rows via `PanelRow`, Members as a `Table` with a `Seg` Members/Invitations switch; no join-date column);
  **General** (`components/workspace/general-tab.tsx`: org name/logo via Clerk
  `organization.update`/`setLogo`, mirrored by the `organization.updated` webhook; a copyable
  **Workspace ID** row, our uuid via `loadOrgIdentity`, the `data-org` of the form / chat snippets;
  Leave / Delete) and **Members** (`members-tab.tsx`: `loadMembers`, search, Members/Invitations
  sub-tabs, invite + role/remove/revoke reusing `workspace/members/actions.ts`). Everyone sees the
  page; the page passes `canEdit` (admin or owner) so viewers and reps get a read-only list
  (no Invite, role pills not selects, no remove, no Update profile / Delete; Leave stays for all).
  `loadMembers` lets any member read the list but only admins get pending invites and Clerk ids; every
  mutating action still enforces its role on the server. Leave/Delete run through guarded server
  actions (`workspace/org-actions.ts` → `leaveActiveOrg`/`deleteActiveOrg`) that sync our DB (delete
  cascades on the org row, since `organization.deleted` has no webhook). `/workspace/members`
  redirects to `/workspace/manage`. `tests/manage-tab.test.ts` guards the wiring.
- **Integrations page** (matches the Claude Design Integrations board 1:1, minus its tab bar: our Workspace sub-menu stays; FULL width): a title row, an info strip (connected tools, booking tool, webhooks 24h), a slim **Needs attention** note (only when something is wrong; a pill per issue), then ONE TAB per panel (`integration-tabs.tsx`: Lead capture, Calendar, Communication, CRM and PSA; Connection health is its own tab (flat, no card); counts = connected tools; panels stay mounted and a `#booking` hash opens its tab; ids unchanged for `JUMP`). Each panel is a `ToolSection` (`tool-section.tsx`: `Card` + `CardHeader` with the section hint and its add button, label/picker title from `SERVICE_GROUPS`, inline searchable picker of the unconnected tools, then rows). A row (`service-row.tsx`, 30px `BrandMark size="sm"`, name + hint, state dot + label, actions) ends with the gear (`manage-dialog.tsx`); the tests ("Send test", "Test connection") live inside the Manage dialogs only, never on the row; "Finish setup" opens the dialog for a "Needs setup" tool. A chosen, connected booking tool reads "In use for bookings". The Calendar panel ends with **Your calendar** (the org's connected calendar, Connected / Not connected) and **Team calendars** (`team-calendars.tsx`: each non-support member with the same Connected / Not connected, because everyone shares the org calendar; nothing per person is stored, no per-user OAuth). "Send reminder" is NOT built (no per-person state to remind about). **Connection health** is last (`health-section.tsx`): one line per service for the last 24 hours, a chip per service that dims the others to 12%. Data: `lib/integrations/health.ts` (`shapeHealth`, tested) over `webhook_deliveries`, which now holds **inbound webhooks and outbound API calls** (`direction`, migration 0045; providers resend, twilio, calcom, calendly, vapi, slack, connectwise, google, microsoft). Outbound calls are recorded by `vendorFetch(..., { track: { provider, orgId } })`; pass `track` on any new vendor call for an org's connected tool (Resend's SDK sends record themselves). Not recorded: OAuth token refreshes, Voyage and Anthropic (platform services, not a tool an org connects), Clerk and Inngest.
- **Integrations windows and "On this page" (2026-11-16, boards IntegrationsForm / IntegrationsChat / IntegrationsSlack):** every tool's settings open in `ToolDialog` (`components/workspace/tool-dialog.tsx`: brand mark, name + state pill + subtitle, close, optional tab row `DialogTabs`, body, footer note + Done; content can put a control in the header (`DialogHeaderRight`) or replace the footer (`DialogFooter`, the chat's "N unsaved changes / Discard / Save changes") through portals). Per-tool subtitle, footer note and width in `lib/integrations/dialog-meta.ts`. **Website form** (`embed-snippets.tsx`): tabs Embed on your site / Your own form; the embed code follows the Brand colour (no `data-accent` / `data-color`) until "Use Brand colour" is switched off, "Phone, address and hours" adds `data-details="false"` when off. **Chat widget** (`chat-widget-form.tsx`): switch in the header, Agent name, Greeting, Bubble position and a live preview, one install snippet. **One URL or key plus a test** (`ServiceKeysForm` in `integrations-ui.tsx`, Slack today): Saved state, a masked box with Replace and Clear, a Send test row. `CodeBox` (`components/workspace/code-box.tsx`) is the shared copyable snippet. Every **Needs attention** line has a button to where it is fixed (`lib/integrations/fix-link.ts`: Twilio goes to Agent → Channels for the SMS number, any other tool to `#<section>:<tool>`, which opens that section and then the tool's window). The Integrations page also has the board's **On this page** list (`integration-tabs.tsx`: a dot per section, green set up, amber needs attention, grey nothing yet; it switches the tab). Profile already had its own.
- **Jump links:** a link from one workspace page to a section of another uses `JUMP` (`lib/jump.ts`, e.g. `/workspace/integrations#booking`). The target carries the matching `id` (Integrations sections use their `group.id`; Agent cards `booking` / `channels`), `components/jump-highlight.tsx` (in `workspace/layout.tsx`) scrolls to it and flashes `.jump-flash` once (`:target` does not update on Next client navigation). `tests/jump-links.test.ts` fails if an id goes missing. Use `JUMP` for every new cross-page link instead of a bare path.
- **Labels:** `lib/ui/status.ts` maps every enum to a sentence-case label + tone (conversation words on every screen: Active, Booked, Handed off in violet, Not a fit muted not red, Closed; no page-local copy)
  (`CONVERSATION_STATUS`, `MEETING_STATUS`, `KB_STATUS`, `CHANNEL_LABEL`, …). Never
  render a raw enum value. Shared formatters live in `lib/format.ts`.
- **Shell:** `(app)/layout.tsx` + `components/app-sidebar.tsx` (232px rail, plan card,
  Clerk controls); Settings pages share `(app)/workspace/layout.tsx` + `settings-tabs.tsx`.
  The agent's on/off state is always in the shell (`components/agent-status.tsx`, read once
  per request via `lib/agent-on.ts`): a row under the theme control on desktop, a dot left of
  the avatar on phones (pulsing dot = online; dot + "Offline" = off). Both link to Agent.
- **Icons:** `lucide-react`, 1.75 stroke, 16px in dense UI. Voice: operator reporting
  in — plain verbs, sentence case, no exclamation marks or emoji.

**Shared primitives (`@alevo/ui`, `packages/ui/src`).** `Button`, `Card`, `Pill` /
`StatusDot`, `Table`, `StatTile`, `CountUp`, `PageHeader`, `Skeleton`, `ThemeToggle`,
`WindowSwitch`, the `Tone` type, `cx` and the status screens live there so the admin
console renders the exact same UI; the files under `components/ui/`, `lib/cx.ts` and
`lib/ui/status.ts` (for `Tone`) just re-export them. Add a new primitive to the package
when the console could use it, otherwise keep it in `components/ui/`.

**Status screens.** One component, `StatusScreen` + `StatusAction` (`@alevo/ui/status-screen`),
draws every can't-see-this state in BOTH apps (the admin console has the same five
route files, standalone): mark, mono "404 · Page not
found" line, display headline, one sentence, actions, optional reference digest.
Route files: `(app)/not-found.tsx`, `forbidden.tsx` (403), `unauthorized.tsx`
(401) and `error.tsx` (client boundary, Sentry + `retry`) render inside the shell;
`app/not-found.tsx` / `app/error.tsx` use `standalone` (own canvas) for routes
outside it; `app/global-error.tsx` replaces the document and loads the theme
itself. Pages call `notFound()` for a missing record and `authInterrupt(error)` (from
`@alevo/auth`) around `requireRole` / `requirePlatformAdmin` — it maps
`ForbiddenError` → `forbidden()` and `UnauthorizedError` → `unauthorized()`
(`experimental.authInterrupts` is on in both apps' `next.config.ts`). Never an inline
Notice for a role failure. The design-system utility mapping (`bg-canvas`, `text-ink`,
`font-display`, `text-title` …) lives in `packages/ui/theme.css`, imported by each
app's `globals.css` after the tokens, with `@source` pointing at `packages/ui/src`.

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
- **0020** `org_profiles.business_address` — the org's postal address, printed in
  every agent email footer (CAN-SPAM / CASL). Edited under Workspace → Profile.
- **0021** `rate_limits` (fixed-window counters keyed by hashed IP / org for the
  public lead endpoint; service path only, no policies).
- **0022** PSA write-back: `org_profiles.connectwise_site` / `connectwise_company_id` /
  `connectwise_member` (keys live in `org_secrets`) + `psa_links` (which Alevo record
  became which PSA record; unique per org/provider/kind/local id; tenant reads,
  service writes). See PSA write-back below.
- **0023** `platform_secrets` — Alevo's own encrypted settings (not per org), edited in
  the admin console (Settings). Today: `internal_alerts_slack_webhook`, read by the
  speed-to-lead watch. `@alevo/db` exposes `set/get/deletePlatformSecret` +
  `platformSecretStatus`; service path only; the admin app needs the same
  `SECRETS_MASTER_KEY` as the app.
- **0025** website chat: `org_profiles.chat_enabled` / `chat_greeting` / `chat_accent` +
  `chat_sessions` (one row per visitor session: the HASH of the token the browser holds,
  `last_seen_at` bumped on every poll; service path only, no policies). See Website chat.
- **0030–0031** `memberships.support` (Alevo staff in a client org — see Admin provisioning) +
  `org_profiles.booking_declined` / `phone_declined` / `slack_declined` ("Not using this" on the setup checklists).
- **0049** `org_profiles.chat_avatar_key` / `chat_avatar_size` ('sm' | 'md' | 'lg', default md) / `chat_avatar_at` — a picture at the top of the chat window instead of the name's first letter, always a circle, filled edge to edge from the centre (`object-fit: cover`; the stored file keeps its proportions), transparent background, never stretched. Set in the Chat widget window (Integrations → Chat widget → Avatar: Upload / Replace / Remove and a size). The browser shrinks it first (`lib/chat/avatar-client.ts`: never cropped (longest side 256px), WebP, under 150 KB, transparency kept); `saveChatWidget` checks it really is WebP (`looksLikeWebp`), stores it in R2 at `organizations/{orgId}/avatars/chat-<uuid>.webp` and deletes the one it replaces. The bucket stays private: the public route `GET /api/chat/[orgId]/avatar?v=<changed-at>` reads it and serves it (`image/webp`, cached a year; the version in the URL changes with the file). `/api/chat/[orgId]` returns `avatarUrl` and `avatarPx` (44 / 60 / 80); `chat.js` draws it in the header, or a circle with the first letter. Pure helpers and tests: `lib/chat/avatar.ts`, `tests/chat-avatar.test.ts`.
- **0036** `org_profiles.chat_agent_name` — the name shown at the top of the website chat window instead of the company name (null = the company name). Set under Integrations → Chat widget → Agent name (max 40); `chatConfig` returns it as `agentName`, `chat.js` shows `agentName || company` (header and aria-label), and the Qualifier's chat prompt tells the agent that is its name (`buildSystemPrompt(..., agentName)`, chat channel only; tested).
- **0035** `org_profiles.brand_text_color` — the **font colour** that goes with the Brand colour (the text ON it: the chat bubble / header / visitor messages, the form's coloured panel and button, the hosted page's `--ds-on-brand`). Null = white or navy by contrast. Set in the Brand colour dialog (below): a second `ColourField` row under the colour, one Save, with a live preview and a contrast warning under 3:1 (`contrastRatio`, `lib/colour.ts`).
- **0033–0034** `org_profiles.brand_color` (0033 added it as `form_accent`, 0034 renamed it) — the workspace **Brand colour** (#rrggbb): the default colour of the website form (embed + hosted page) and the chat bubble, chosen with the colour picker in the Brand colour card at the top of Integrations. `chat_accent` is the older chat-only colour, read only while this is blank.
- **0032** `org_profiles.contact_email` / `contact_phone` / `contact_hours` — the public details beside the contact form (with `business_address`); edited under Workspace → Profile → Contact details.
- **0037** contact identity — emails/phones normalised, contacts sharing a phone merged, unique `(org_id, phone)` (email was unique since 0007). **0038** `contacts.last_activity_at` (not null, default now) + `app.touch_contact_activity()` triggers on `messages` / `conversations` / `calls` inserts. See Contacts, clients and calls.
- **0040** `kb_chunks.embedding_model` — which model made each vector (see Knowledge base).
- **0044** `org_profiles.voice_labels jsonb` — a name per voice id (`{"Elliot":"Max"}`, set in the Voices boxes under Agent → Channels; letters, spaces and . ' - only, 30 max: `cleanVoiceLabel`). The agent goes by the name of the voice picked for that call: `buildAssistantBody` adds ", this is Max" to the greeting and "Your name is Max." to the prompt (`labelFor`); a voice with no name gives none.
- **0043** `org_profiles.last_voice` — the voice that answered the last call; the `assistant-request` webhook saves it and `pickVoice` skips it next time whenever another voice is on.
- **0042** `org_profiles.voice_names text[]` — the voices the org turned on; each call uses one at random (`pickVoice`, per `assistant-request`), empty = Clara. Replaces 0041's single `voice_name`, which stays unused. Switches + play buttons in `voice-picker.tsx`; at least one stays on.
- **0041** `org_profiles.voice_name` (superseded by 0042) — the phone agent's voice, one of Vapi's built-in voices (`lib/voice/voices.ts`: Savannah, Emma, Clara, Elliot, Nico, Sid — all Version 2, set as `version: 2` on the assistant voice; null = Savannah). Set under Workspace → Agent → Channels, with a play button (`voice-sample.tsx`) for the 12-second clips in `public/voices/<Id>.mp3`, trimmed from Vapi's own docs samples; `mp3` is excluded from the proxy matcher so they are plain static files.
- **0046** `meetings.rep_user_id` (uuid, references `users`, on delete set null; index `(org_id, rep_user_id)`) — the rep who owns a meeting; null = Unassigned, which is how the agent books. The existing row-level `meetings_tenant` policy already covers it. Assigned on the Meetings page (`assignMeetingRep`, rep+, member of this org and not support, audited `meeting.rep_assigned`).
- **0047** `org_profiles.website` (text, check length <= 200) — the company website, set under Profile → Company (`cleanWebsite` in `lib/profile/website.ts`: https only, bare domain gets the scheme, `http://` upgraded, no login / private host / query; per-field error). It is the default address in Import from website.
- **0051** `vendor_spend` — what each vendor call costs us, per environment (service path only, no policy). One row per call: `env` (development / staging / production; dev and staging share this database, so the column is what tells them apart: `currentEnv()` in `lib/usage/spend.ts` = staging when `NEXT_PUBLIC_APP_ENV=staging`, production when `NODE_ENV=production`, else development), `provider`, `kind`, `org_id`, `units` (tokens / segments / emails / minutes), `cost_usd`, `estimated`. Written fire-and-forget by `trackClaude` (agent turns, call summaries, website import: from the response's `usage`), `trackEmbedding` (Voyage), `trackSms` (Twilio, out and in, by segments), `trackEmail` (Resend), `trackCall` (Vapi's own cost from the end-of-call report; the one non-estimated figure). Rates are public-price estimates in `lib/usage/spend.ts`: update them when prices change. Read by Admin console → **Spend** (`/spend`: a window switch, a tile per environment, a table per environment by vendor; `spendSummary` / `spendSeries` in `@alevo/db`). **Input and output (0053):** AI rows also carry `input_tokens`, `output_tokens`, `input_cost_usd`, `output_cost_usd` (`claudeSplit` in `lib/usage/spend.ts`; input counts every token sent, cached or not, priced at the cached rate where it was; an embedding is all input). Rows from before 0053 have only the combined figures, and the By model card says how many tokens that is. The Spend page's By model card shows both sides with the effective price per 1M tokens. Test: `tests/vendor-spend-db.test.ts`.
- **0024** pagination indexes — `conversations (org_id, created_at desc, id desc)`,
  `meetings (org_id, coalesce(start_at, created_at) desc, id desc)`,
  `audit_log (created_at desc, id desc)` (replaces `audit_log_created_at_idx`). See
  Pagination below.

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
  `formatSlot` written vs. spoken) — both `check_availability` tools use it. With a
  `day` (YYYY-MM-DD) the tool returns every open slot that day (`daySlots`) — the
  agent calls it again when the lead asks for a day or time it didn't offer. **Never
  offer times the calendar didn't confirm:** Google free/busy with a per-calendar
  `errors` list throws (`busyFromFreeBusy`, tested), and any throw while resolving
  the adapter or booking goes through `bookingBroke` (hand-off + the calendar's
  reason), never a bare tool error. Calendly
  mode sends the link in the same turn; no calendar at all → promise a callback
  within a business day and hand off. The prompts, the tool descriptions and the
  nudge directive all say this; keep them in step if you change one.
- **After a hand-off the agent keeps answering (2026-11-02).** `handed_off` is not terminal (only `booked` / `closed` are): `loadQualifierContext` returns the status and `buildSystemPrompt(..., handedOff)` adds an "ALREADY HANDED OFF" note: answer to the best of its ability, exactly one reply every time, don't re-announce the hand-off, and a request to book OVERRIDES the hand-off (`check_availability` → `book_meeting`, or `send_booking_link`; with no calendar it confirms a colleague will set the time). A successful booking sets `booked` as usual. `set_status('handed_off')` only alerts the team + PSA when the status newly becomes handed off (it reads the previous status), so a conversation that is already handed off never re-alerts. Cadence nudges stay off for handed-off conversations (`WORKABLE`). Without the note the model read its own "a colleague will follow up" and went silent. Tested in `tests/qualifier-prompt.test.ts`.
- **A lead marked Not a fit keeps getting answers (2026-11-16).** `disqualified` is not terminal either (only `booked` / `closed` are): the agent runs on every inbound message and `buildSystemPrompt(..., notAFit)` adds a "MARKED NOT A FIT" note when `ctx.status === "disqualified"`: answer for as long as they talk, exactly one reply, no pitch, no repeating the verdict, and `set_status('active')` (or `handed_off`) if what they say changes the picture. Without it the agent read its own polite "this isn't a fit" and went quiet. An SMS from such a lead attaches to the SAME thread (`/api/webhooks/twilio` only starts a new conversation after `closed` / `booked`), so the agent has the history and no second conversation is metered. Cadence nudges still only work `new` / `active` threads. Tested in `tests/qualifier-prompt.test.ts`.
- **The agent answers whatever the conversation is marked as (2026-11-16).** No status stops it any more (`booked` and `closed` used to): it runs on every inbound message and ends only when the contact says thank you or stops replying. `buildSystemPrompt(..., status)` adds a note for booked (answer, never book again, `escalate_to_human` for a change, never `set_status`), closed (answer, `set_status('active')` if they are interested again) and not a fit, and a base rule: a message that is only thanks or goodbye gets ONE short closing line and `set_status('closed')` (now a settable status), which also stops the follow-up nudges. SMS from such a lead joins the latest SMS thread whatever its status. Still paused by the org's own switches: agent off, plan limit, opt-out. Tests: `tests/qualifier-prompt.test.ts`.
- **A reply is guaranteed, one question at a time, no pricing (2026-11-17).** The agent only answers through `reply_to_contact`, and staging showed runs that saved a name and ended with no reply and no error (Inngest output `replied: false`; the 5-minute watchdog then marked the lead handed off). `driveAgent` (`lib/qualifier/loop.ts`, tested in `tests/qualifier-loop.test.ts`) is the model/tool loop `runQualifier` calls: when a run owes a reply (`mustReply`, every run except a cadence nudge) and stops without one, it adds a user turn (`REPLY_NUDGE`, up to `MAX_NUDGES` = 2; forced `tool_choice` is not used, it 400s on the newest models and clashes with thinking). Messages the contact sends while a run works are answered in the same run (`fresh` = `contactMessagesNotIn`, `lib/qualifier/fresh.ts`, up to 2 catch-ups; found BY ID, never by timestamp: Postgres keeps microseconds and a JS Date milliseconds, so a "newer than the last message" query matched the contact's own message and the agent replied three times, 3 to 5 seconds apart, `tests/qualifier-fresh-db.test.ts`): a later run would see our reply as the last turn and skip them (`awaiting-contact`). The run result carries `trace` (`turns`, `tools`, `nudges`, `catchUps`) so the Inngest run page shows what happened. Prompt (`prompt.ts`): the line that let the agent skip a reply is gone; real-time channels allow AT MOST ONE question per message (name + email together count as one); in chat the goal is a booked appointment (offer to book as soon as name + email are known, never end a message without a next step); `PRICING_RULES` / `PRICING_EXAMPLES` (`guard.ts`, in the text AND voice prompts): never state or hint at prices; a pricing question is handed to a sales rep in the agent's own words, different each time (the examples are only examples; a fixed line read as a script), then on to booking. Pricing no longer triggers a hand-off. Speed: the `qualify-conversation` debounce is 1s (was 8s, then 2s) and the widget polls every 1s for 90s after a send (was 2s). Tests: `tests/qualifier-rules.test.ts`.
- **The status is a live label (2026-11-17).** Whatever a conversation is marked as, the agent re-judges it on every message: when what the contact says no longer matches, it changes the status with `set_status` and re-scores with `record_fit_score`, then acts on the new status at once (reopened or newly qualified: qualify and book; newly not a fit: polite, no pitch; ready for a person: hand off). The Not-a-fit note spells out the reopening and the booking per booking mode (`check_availability` + `book_meeting`, `send_booking_link`, or a colleague's call), because the booking tools already book such a lead and set it to booked. A booked conversation stays booked (the `notBooked()` guard in `tools.ts`); meeting changes go to a colleague via `escalate_to_human`. Tests: `tests/qualifier-rules.test.ts`.
- **Times are in the contact's timezone, or the org's and said so (2026-11-17).** The chat widget sends the browser timezone with the first message (`cleanTimeZone`, stored on the new contact); forms already did. The agent can also save one the contact tells it (`save_contact_details` `timezone`). When the contact's is unknown the Qualifier assumes the org's (Eastern if the org never chose one, never UTC), names the zone with every time and invites a correction (`timezoneKnown` on the dispatch target). The Agent page cannot be switched on without an org timezone (`timezoneRequiredError`); its picker lists one entry per zone with its UTC offset (`lib/timezones.ts`). The agent is told the current date and time in that zone on every run.
- **Sounds like a person, answers everything, replies fast (2026-11-18).** `HUMAN_RULES` (`prompt.ts`): plain words and contractions, no verdict openers ("Good fit —"), full sentences instead of dashes, times as "10:00 AM Eastern" never "America/New_York". `plainPunctuation` (`punctuation.ts`) is the net under it: `deliverMessage` rewrites any em dash, en dash or spaced hyphen (full stop before a new sentence, comma inside one, "9am to 12pm" for a range) in every message the agent sends, so a model habit can never reach the contact. The prompt also says: answer EVERY question in the one reply (the one-question limit is about what the agent asks), and a booking turn still answers a second question the contact asked (it used to end on "you are DONE", and the value-prop question in the same message went unanswered until they asked again). Speed: `driveAgent` dispatches `reply_to_contact` first in a batch (the contact is waiting; bookkeeping tools in the same batch follow) and the prompt asks for bookkeeping in the same turn as the reply, not in turns before it (each extra model turn was 3 to 5s); chat and SMS runs use effort `low` (email / forms stay `medium`); the debounce is 1s; the run `trace` now carries `modelMs` per model call and `kbMs`. `qualify-conversation` runs ONE run per conversation at a time (`concurrency` list: conversation 1, org 2): two overlapping runs answered the same message twice, the second from a thread that did not yet hold the first's reply. Widget: the "after" cursor only moves from polled server messages, never from the visitor's own just-sent message (it jumped past a reply that was written but not fetched yet, which then never appeared until the visitor wrote again). Tests: `tests/qualifier-punctuation.test.ts`, `qualifier-loop`, `qualifier-rules`, `qualifier-booking-email`.
- **One booking per conversation (2026-11-19):** `check_availability` and `book_meeting` first look for the conversation's upcoming scheduled meeting (`upcomingMeeting`, `tools.ts`) and, if there is one, answer "ALREADY BOOKED" without touching the calendar. A contact's own booking shows as busy on the calendar, and on staging the agent read that as a clash after each "thank you", apologised and booked a second and third meeting (12:30, 1:00 and 1:30 for one person). Changes go through `escalate_to_human`; a cancelled meeting (status no longer scheduled) lets the contact book again. Test: `tests/qualifier-already-booked.test.ts`.
- **Which model wrote a reply (2026-11-19, migration 0054):** `messages.model` holds the AI model id behind each agent reply (stamped by `deliverMessage` from `target.model`, which `run.ts` sets to the model of the call that decided the tool; null for people, contacts, fixed nudges and older messages) and `vendor_spend.conversation_id` ties each agent call's cost to its conversation (`conversationSpend`, `@alevo/db`). BOTH ARE FOR ALEVO STAFF ONLY: the thread page (`conversations/[id]/page.tsx`) drops the model unless `getCurrentUser().isPlatformAdmin`, and shows a "Alevo staff only" strip with calls and cost per model. A client never sees either (the chat widget API and every other message read select explicit columns). Tests: `tests/qualifier-booking-email.test.ts`, `tests/vendor-spend-db.test.ts`.
- **Web chat model switch (2026-11-18):** Admin console → Settings → **Web chat model** is a Claude / ChatGPT switch (platform setting `web_chat_model`, `"chatgpt"` while on, absent = Claude; `webChatModel()` in `lib/qualifier/model-choice.ts`, cached 15s). It only affects the `chat` channel; email, SMS, forms, voice and every cadence run on another channel stay on Claude. The agent loop and the whole history stay in Anthropic's message format: `lib/qualifier/openai.ts` (`openaiRun`: OpenAI **Responses API**, `gpt-6-luna` in `OPENAI_MODEL`, reasoning effort `medium`, `store: false` with the encrypted reasoning items held for the run) translates each turn through the pure `openai-convert.ts` (tested). ANY ChatGPT failure (no `OPENAI_API_KEY`, HTTP error, timeout, unreadable tool arguments) is caught in `run.ts` and that turn is answered by Claude instead (Sentry gets the error); the run `trace` carries `models` (one per call) and `fallbacks`. Spend: `trackOpenAI` records provider `openai` with the input / output split; `gpt-6-luna` is $0.10 input / $0.50 output per million (`OPENAI_RATES`, `lib/usage/spend.ts`); the cached-input share in that table is an assumption. Tests: `tests/openai-convert.test.ts`.
- **Fast cadence for testing (2026-11-16):** `CADENCE_FAST=1` still works, and Admin console → Settings → Testing has a Fast cadence switch (platform setting `cadence_fast` in `platform_secrets`, "1" while on). `isFastCadence()` (`lib/cadence/fast.ts`) reads it at most every 15s; the cadence and the no-reply watchdog decide it once per run in a step (`followupSchedule(fast)`: 20s, 30s, 40s instead of 1d, 3d, 3d; `noReplyAfter(fast)`: 30s instead of 5m). It affects every workspace: keep it off in production.
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

**Org notifications — Slack + email** (`lib/notifications/`). `notifyOrg(orgId, text,
email?)` (`notify.ts`) posts to the org's Slack webhook (`notifySlack`, Integrations →
Slack) AND emails the same text to the owners/admins (`ownerEmails`, `owner-emails.ts`;
first line = subject, Slack emoji codes stripped — `emailFromSlack` — or a richer
`{subject, body}` such as `bookingFailedEmail`) unless `org_profiles.email_alerts` is off:
the "Email the team" switch under Workspace → Agent → Notifications (migrations
0026–0027, default on). Plan-limit emails ignore the switch (billing); the Integrations
"Test" button is Slack-only. Best-effort throughout. **Slack card health**
(`org_profiles.slack_last_error` / `slack_verified_at`, migrations 0028–0029): a saved
webhook is **Untested** until the first successful post stamps `slack_verified_at`
(the issue row says to Send test); a failed post keeps Slack's own reason (via
`vendorError`) and the card reads **Needs attention**; saving or clearing the webhook
resets both (`resetSlackHealth`). Pure status logic in `services.ts`. What posts: a lead's first
strong-fit score (`crossedStrongFit`, ≥ 70, from `record_fit_score` in the Qualifier
and voice tools), a meeting booked (`notifyMeetingBooked` from `book_meeting`, the voice
booking, a Cal.com booking Alevo didn't make, and Calendly), hand-off / escalation
(`notifyHandoff` in the tools), the no-reply fallback (`notifyUnansweredLead`, see
Durable workflows), **booking failed** (`notifyBookingFailed`: `check_availability`
threw or `book_meeting` failed for a reason other than a slot conflict, in the
Qualifier and voice tools → the lead is marked handed off and the org gets "Booking
failed for a qualified lead … Calendar said: <vendor reason>"; the model is told to
promise a human follow-up, and its later `set_status('handed_off')` skips the generic
hand-off post via `effects.bookingFailed`), the voice call summaries / messages, and
the plan-limit alerts. Message text is pure in `lead-messages.ts` (tested);
`lead-events.ts` loads the records.

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
  / `conversation_id` tags. The footer (`emailFooter` in `resend.ts`) names the
  sender ("Sent by <Org> · <business_address>" — the MSP is the sender, so it is
  THEIR address, from Workspace → Profile), the unsubscribe link, and
  "reply to request a copy or deletion of your data" + the privacy policy link.
  The Qualifier prompt handles a data request by confirming, escalating with
  "Data request: …" and handing off — it never argues or keeps qualifying.
  `sendPlatformEmail` is the plain transactional sender (usage alerts) — no
  unsubscribe footer, from "Alevo". `email.bounced` / `email.complained` webhooks →
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
  Vapi's dashboard; calls don't use it directly. A number WITH an assistant attached
  never sends `assistant-request`, so that stale assistant answers every call (bit us
  2026-11-02: a calendar connected after the attach was never offered). Every Phone
  calls Save therefore re-asserts the routing on an existing number
  (`detachAssistantFromNumber`: `assistantId: null` + current server URL/secret).
  Every call is its own conversation (`callThread`, see Contacts, clients and calls).
- **A number belongs to one org (2026-11-12).** The Vapi record follows the number: changing or clearing the SMS number drops `vapi_phone_number_id` and switches calls off (`saveAgentSettings`); turning calls on adopts Vapi's existing record for that Twilio number if there is one (`importTwilioNumber` reads "Existing Phone Number <id>" from the 400) and `releaseVapiNumber` takes the record away from any other org holding it; the webhook only answers while the number dialled matches the org's saved one (`numberMatches`, `lib/voice/number.ts`). A line that is off, moved or unknown says only "This phone is not in service right now." — never "text this number", because the number may belong to someone else now. The voice is picked per call from `voice_names` (`voiceFor` in `assistant.ts`; Vapi rejects ids that are not built-in).
- **Mode** = `voiceModeNow(profile)`: weekdays within the booking hours in the org's
  timezone, via `profileTimeZone` (falls back to `DEFAULT_TIMEZONE`, never UTC — a null
  timezone once made 3pm Ottawa read as 7pm UTC = "closed").
- **Booking after hours too.** `bookingOnCall(mode, afterHoursStyle, bookingConnected)`:
  open calls always; after hours when the org takes details (not plain voicemail). The
  greeting is the SAME after hours as during the day and the prompt forbids "we're
  closed" (owner, 2026-11-02); only voice-off turns a caller away. Any meeting booked
  after hours lands in office hours.
- **Who called:** `save_contact_details` (`lib/contact-details.ts`, shared with the
  Qualifier) writes name / email / company onto the contact as soon as the agent learns
  them; `take_message` and `book_meeting` save the name too. Conversations fall back to
  the phone number when there is no name or email. Transcriber is Deepgram nova-3; the
  prompt tells the agent to ask for a spelling once rather than loop on a name.
- **Sounding human:** Vapi speaks a stock filler at the start of every synchronous tool
  call unless the tool has its own `request-start` message. Bookkeeping tools
  (`save_contact_details`, `record_fit_score`, `set_status`) run `async` (silent); the rest
  carry one natural line ("give me a few seconds while I get that booked") plus a
  `request-response-delayed` line at 6s ("Still with you — just a few more moments"), and the
  prompt tells the model NOT to add its own waiting line before those tools — the two
  together said "give me a few seconds" three times in eight seconds (2026-11-02). The voice
  `book_meeting` falls back to the email on file when the model forgets to pass it, so it is
  never re-asked (a retry re-speaks the tool's line). The prompt
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

- **Booking turns on by itself (2026-11-02).** The first time a tool becomes connected (Cal.com key + event type, a Google / Microsoft 365 calendar, a Calendly link) and no tool is chosen yet, `enableBookingOnConnect` (`lib/booking/auto-enable.ts`, called from `saveCalcom`, `saveCalendly` and the OAuth callback) sets `booking_tool` to it and clears "Not using booking". The rule is `newlyConnectedTool` in `lib/booking/connected.ts` (tested): it only fires on the not-connected → connected transition, so re-saving a tool's settings never undoes someone turning booking off. Existing orgs are not back-filled.
- **Connect vs. behave (two places, by design):** every tool is *connected* under
  **Workspace → Integrations** (its Manage dialog holds everything that makes it
  usable — Cal.com: event type ID + API key + webhook secret (`calcom-form.tsx`);
  Google / Microsoft 365: Connect (a link into the OAuth start route) + Disconnect
  (`calendar-connect.tsx`; the callback returns to Integrations, where
  `connect-result.tsx` turns `?calendar_connected=` / `?calendar_error=` into a toast
  and clears the query — the error toast stays until closed, never inline, never
  left in the address bar); Calendly: link +
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
  **Test connection** (`testCalendar`, on the Integrations card once connected) makes
  the same free/busy call for the next 72 hours and reports the open-slot count, or
  the vendor's own reason plus a fix (`lib/booking/calendar-test.ts`, pure, tested:
  Calendar API not enabled in the Cloud project → enable it; `invalid_grant` /
  access denied → reconnect). Failed vendor responses throw
  `vendorError(res, label)` (`lib/http/vendor-error.ts`) so Sentry and the admin
  see "Google free/busy failed (403): Google Calendar API has not been used in
  project …", never just the status. The Cloud project that owns the OAuth client
  must have the **Google Calendar API enabled** — OAuth consent alone is not enough
  (bit us 2026-10-28: tokens refreshed fine, every calendar call 403'd).
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
  show outcome + converted only. Board layout (2026-11-13): window switch (`?window=`, default 30) scoping an info strip (show rate, next meeting, booking calendar), four `StatTile`s with bars + delta vs the prior window (`lib/meetings/figures.ts`, tested), a Booked-per-bucket chart, then the table: outcome is a Pending / Showed / No-show segmented radiogroup plus a Converted toggle, Reschedule / Cancel are icon buttons (Cancel still confirms). Each row has a **Rep** column (`RepControl`: a Select of the org's members, saves on change for rep+, plain text for viewers; `lib/meetings/reps.ts`, tested) and the **Booked by rep** donut beside the chart counts the Booked set per rep (+ Unassigned, Former member) in the same window. Not built: Week view, toolbar (Refresh / Export / Filter / Columns). The conversation thread shows the booked meeting
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

## Lead form (hosted, embed, API)

One capture path for every way a lead arrives from a website: `lib/leads/capture.ts`
(`captureLead`: validate, spam checks, rate limits, then contact + conversation + first
message + consent + metering + `conversation/message.received`). `fields.ts` holds the
field reading/validation and `spam.ts` the checks, both pure (`tests/lead-form.test.ts`).

- **Hosted page** `/form/[orgId]` (server action `submitLead` → `captureLead`). There is no iframe mode (removed 2026-11-02); `?submitted=1` / `?error=1` are where a plain
  HTML post to the API lands.
- **Endpoint** `POST /api/forms/[orgId]` (public in `proxy.ts`, open CORS): JSON,
  form-encoded or multipart → `{ ok: true }` / 400 `{ errors }` / 404 / 429 / 500. An
  `Accept: text/html` form post is redirected to the hosted page instead.
- **Contact card (2026-11-02):** `app/form/[orgId]/page.tsx` renders one card, a brand-colour panel (heading, blurb, `ContactInfo` on `text-on-brand`) beside `LeadForm` (underline `LineInput`/`LineTextarea`, pill button); stacks below `md`. `embed.js` mirrors it with flex-wrap (stacks when the container is narrow, plus a max-width 640px media query for padding). Keep the two in sync.
- **Contact details + colours:** `loadContactDetails` (`lib/leads/contact-details.ts`, cached per request) feeds the hosted page's details column (`contact-info.tsx`) and the public `GET /api/forms/[orgId]` the embed reads (`?details=0` / `data-details="false"` hide the column; the response is cached 60s, so a changed Brand colour takes up to a minute to reach an embed). **Brand colour (default colours):** ONE colour per workspace, `org_profiles.brand_color`, saved by `saveBrandColour` from the Brand colour card (`brand-colour.tsx`) through the custom `ColourField` (`components/ui/colour-picker.tsx`). **Layout:** the card on the Integrations page is only a summary: both colours as swatches with their hex (dashed swatch + "Default (…)" when blank), a "Preview" button wearing the pair and a **Manage** button. Manage opens a dialog with a Colour row, then a Font colour row under it; each row is a 44px swatch + a hex field (`#rrggbb` or `#rgb`, tidied on blur) + Use default, and clicking the swatch opens the picker as a popover (saturation / brightness area, hue slider, Done; pointer, touch and arrow keys; Esc closes the picker only, not the dialog; click elsewhere closes it). Cancel / Esc / backdrop discard, Save is disabled until something changes and a successful save closes the dialog (derived from the action state, no effect). Maths in `lib/colour.ts`, tested. It is the DEFAULT; a page overrides it. The saved **font colour** (`brand_text_color`) is the text ON the brand colour: it reaches the embed as `textColor` in the details response (panel and button text), the chat as `textColor` in its config (`data-color` default), and the hosted page as `--ds-on-brand`. It belongs to the saved brand colour, so a page that picks its own accent (`data-accent`, `--alevo-accent`, `?accent=`) falls back to the automatic white / navy unless it sets its own text colour. `data-color` / `--alevo-color` mean the same in the embed and the chat: the text colour ON the accent (panel + button / bubble + header + messages); the embed form's own text and background follow the page. Embed accent (panel + button), most specific first: script `data-accent`, a `--alevo-accent` CSS variable, the Brand colour (the `accent` field of the details endpoint), then the page's text colour. Text on that panel and button: `data-color` / `--alevo-color`, else the saved font colour, else white / navy by contrast. Hosted page: `?accent=<hex>`, else the Brand colour, else Alevo blue. Chat: see Website chat. Background, error red and the panel's text (white or navy by contrast) are derived from the page, and `embed.js` repaints when the page changes theme after load (MutationObserver on `<html>` / `<body>` attributes + `prefers-color-scheme`), so a site can give each theme its own colours with `--alevo-accent` / `--alevo-color` under its dark selector. The hosted page `/form/<id>` is always light (a `.light` wrapper re-applies the light tokens inside the dark app theme) and is not offered as a snippet under Integrations. The embed fills 100% of the element it is placed in (no max width), stacks panel above form below ~740px (then the contact list is two columns), and fills in details (and the colour) that arrive after its 3s wait. The hosted page moved from `/f/<id>` to `/form/<id>` (a permanent redirect keeps old links working). **Dev gotcha:** through a free ngrok URL, a cross-site fetch from the customer's page gets ngrok's browser-warning page (no CORS headers), so the embed shows no details, the chat bubble never mounts and nothing can submit; point the customer site at the local app (`http://localhost:3001`) or a tunnel without that interstitial.
- **Website import + tone presets:** `lib/http/safe-fetch.ts` is the only way to fetch a URL a user typed (resolves DNS, blocks private/loopback/metadata addresses, re-checks every redirect, caps size and time); KB `extractUrl` and the profile import both use it. `lib/profile/{crawl,extract,merge,import-error}.ts` back `importFromWebsite` (profile `actions.ts`, admin only, rate limited, writes nothing; the client merges into the live form with `mergeImported`). `lib/profile/tone.ts` holds the five tone presets: `org_profiles.tone` stores the key, `toneForPrompt` expands it for the qualifier and voice prompts and passes legacy free text through. Modules covered by vitest import siblings relatively (no `@/` alias in vitest).
- **Contact preference (2026-11-17, migration 0050):** the form asks "How should we reach you?" as a DROPDOWN (Email / Text message) in the embed (a styled native `select`), the hosted page (our `Select`) and the API (`contactPreference`: "email" | "text"; also "sms" / "text message"). Required, but empty or missing means email, so forms that never send it keep working (`normalisePreference` in `lib/leads/fields.ts`, tested). Anything else is refused ("Choose email or text."); "text" without a phone number is refused on the phone field ("Add a phone number so we can text you."). The latest answer is kept on `contacts.contact_preference` (`captureLead`), shown in the thread's Details ("Prefers") and given to the agent (`Prefers: ...` in the prompt); a `form` / `email` conversation whose contact chose text is answered by SMS when there is a number and an org sending number (`smsWanted` in `deliverMessage`), else by email.
- **Embed** `public/embed.js` (vanilla, no build): renders the form into `data-target`,
  posts JSON to the endpoint, spinner + disabled fieldset while sending, per-field errors
  inline, thank-you block on success. Snippets (script, API) are
  copyable under Integrations → **Lead capture** → Website form (`embed-snippets.tsx`; the hosted page is not offered there, it is only linked from Conversations and the Dashboard).
- **Spam** fails quietly (a normal thanks, lead dropped): honeypot field `website`,
  fill time under 2s (`startedAt` set client-side after mount), and fixed-window rate
  limits (`hitRateLimit` in `@alevo/db`, table `rate_limits`, 0021): 10 per IP per
  10 min (IP hashed), 300 per org per hour. The limiter **fails open** on an error.
  The consent row records the source: `hosted_form` / `embed` / `api`.

## Website chat (widget)

Sprint 7.1. One script tag on the customer's site (`public/chat.js`, vanilla, no build)
draws a bubble; the visitor talks to the Qualifier over the `chat` channel. Settings
(on/off, greeting, colour) live under Integrations → Lead capture → **Chat widget**
(`chat-widget-form.tsx`, `saveChatWidget`); the card shows On / Off.

- **Endpoints** (`app/api/chat/[orgId]/`, public in `proxy.ts`, open CORS, bearer token):
  `GET` = config (404 while the widget is off; cached 60s). `POST messages` without a
  token = `startChat` (anonymous contact `source: chat`, `chat` conversation with the
  message, a `chat` consent with the widget's disclosure line verbatim, a `chat_sessions`
  row, `inbound_conversations` metered, `conversation/message.received`); returns the
  token the browser keeps in localStorage. With a token = `postChatMessage`. `GET
  messages?after=<iso>` = the thread + conversation status, and bumps `last_seen_at`.
  An unknown token answers 401 `{ restart: true }` and the widget starts over.
- **Logic** in `lib/chat/`: `rules.ts` is pure (limits, `cleanMessage`, token + hash,
  `visitorPresent`; `tests/chat.test.ts`), `service.ts` is the DB side (service path,
  scoped to the org in code; rate limits via `hitRateLimit`, fail open: 10 new chats /
  60 messages per IP per 10 min, 2000 per org per hour).
- **Where the reply goes** (`deliverMessage` in `lib/qualifier/tools.ts`): a visitor
  whose widget polled in the last 2 minutes is "present" → the reply is only recorded
  (channel `chat`) and the widget shows it. Otherwise it falls through to email when the
  contact gave one (the widget still shows it if they return); with no email it is just
  recorded. The system prompt tells the agent to ask for name + email early on chat.
- **Dialog layout**: the on / off switch sits in the Manage dialog's top-right corner on the title line (absolutely placed against the dialog panel from inside the form, so it is still saved by the same Save / Cancel; no ancestor of it may be positioned), and there is no "Show the chat bubble" row any more.
- **Colours**: the default is the workspace Brand colour (Integrations → Brand colour card; the chat dialog has no colour field of its own; `chatConfig` returns brand colour, else the legacy `chat_accent`, else Alevo blue). The page can override it with `data-accent="#hex"` (bubble, header, visitor messages, send button) and `data-color="#hex"` (text and icons on those), or `--alevo-accent` / `--alevo-color` in its CSS (per theme). Order: attribute, CSS variable, Brand colour. Text on the accent is white unless the accent is too light for it (about 3:1), then navy; `data-color` always wins. Any CSS colour is accepted (resolved by the browser); an invalid one is ignored. **One install snippet (2026-11-02):** the Chat widget dialog has a Bubble position picker (right / left; not saved, it only changes the code) and ONE snippet that always carries `data-position`, `data-accent` (the Brand colour, else the older chat colour, else Alevo blue) and `data-color` (`chatTextColour` in `lib/colour.ts`, the same rule as chat.js, tested), so nothing is looked up; deleting the colour attributes makes the chat follow the Brand colour again. A "What the settings in the code do" list sits under it. The Website form dialog's embed snippet likewise always carries `data-accent` (Brand colour, else Alevo blue) and `data-color` (the saved font colour, else `chatTextColour` of the accent), never `inherit`. Pasted attributes are fixed for that site: a later Brand colour change does not reach a site whose snippet still has `data-accent`.
- **Phones (2026-11-17)**: under 480px the window is the part of the screen that is visible (`visualViewport` height and offset, `fitViewport` in `chat.js`), so when the keyboard opens the whole chat moves up with it: the name bar (avatar and name) stays at the top, the input stays above the keyboard and the newest message stays in view (pinned to the bottom while the reader is at the bottom, and on focus). The page behind is locked while it is open, the input text is 16px so iOS does not zoom, and the header and footer never shrink (the log scrolls).
- **Widget behaviour**: polls every 2s for 90s after a send (typing dots), then every
  10s while open, never while the tab is hidden; dedupes by message id; shows a system
  line on `handed_off` / `booked`; full-screen under 480px; reduced motion respected.
  The Qualifier's 2s debounce is the floor on reply time (about 6s end to end).

## Consent (compliance)

Consent is data, not a checkbox (plan.md rule 8). The `consents` table (0007)
records one active row per (contact, channel); `@alevo/db` exposes `recordConsent`
/ `revokeConsentForContact` / `revokeConsentForEmail`.

- **Captured** on every inbound touch: hosted form (lead action), email reply
  (`/api/webhooks/resend`), SMS inbound (`/api/webhooks/twilio`), website chat
  (`startChat`, basis `chat_initiated`, the widget's disclosure line verbatim). `recordConsent`
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
  an R2 presigned-GET) → chunks (`chunk.ts`: URL and text sources split on headings, `chunkByHeadings`, each chunk starting with its heading path such as "Pricing › Website plan", tiny sections carried forward, long ones split with the path kept; a URL is read by `htmlToMarkdown`, which keeps only the page content: no nav, footer, aside, form or script, `<main>` only when there is one; a PDF is read by `pdfToMarkdown` (`pdf-structure.ts`: text set larger than the body text becomes the headings, biggest first; running headers, footers and page numbers repeated in the page margins are dropped; lines of a paragraph are joined), pasted text with no `#` lines gets its ALL-CAPS or numbered lines promoted (`plain-headings.ts`); anything with fewer than two headings uses the plain ~1500-char split with overlap) → embeds
  (`embeddings.ts`, **Voyage `voyage-4-lite`, 1024-dim**, raw HTTP) → stores
  `kb_chunks`, sets `ready`/`failed`. PDFs reuse the files presign route for upload.
- **Retrieve:** `retrieve.ts` embeds the latest inbound message as a query and
  pulls top-k chunks by cosine similarity (drizzle `cosineDistance`, hnsw index),
  injected into the Qualifier's system prompt. Best-effort: no `VOYAGE_API_KEY`,
  no KB, or any failure → the Qualifier proceeds ungrounded.
- **View and edit passages (2026-11-18, migration 0052 `kb_chunks.edited_at`):** a Ready document's list icon opens `chunks-dialog.tsx` (admins and owners: the whole Knowledge page is admin-only): its passages in order, 25 a page, each with Edit / Delete. `saveChunk` (`knowledge/actions.ts`) cleans the text (`cleanChunk`, `lib/kb/chunk-edit.ts`: not empty, max 3000 chars), RE-EMBEDS first and only then updates the row (a Voyage failure changes nothing), sets `edited_at`, audits `kb.chunk_edited`; `deleteChunk` removes it, lowers the document's `chunk_count`, audits `kb.chunk_deleted`. A document with edited passages asks before Re-index, because ingest deletes and re-inserts every chunk. Test: `tests/kb-chunk-edit.test.ts`.
- **Env:** `VOYAGE_API_KEY`. Embedding dim (1024) is baked into the migration.
- **Model changes (0040):** vectors from different models are not comparable even at the
  same dimension, so `kb_chunks.embedding_model` records which model made each vector
  (`EMBEDDING_MODEL` in `embeddings.ts`) and `nearestChunks` only searches that model.
  To upgrade: change the constant, deploy, then re-run `ingestDocument` for every document
  (it deletes and re-inserts the chunks); chunks of the old model are ignored until then.

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
- `chat-cadence` (`lib/chat/cadence.ts`) is the **website chat's own** follow-up: after the agent replies in a
  `chat` conversation the Qualifier fires `chat/awaiting-reply` (not `conversation/awaiting-reply`, so a chat never
  gets the days-long cadence directly). Fixed lines, no model call: a nudge at +3m, another +2m later, and at +1m
  more a closing line and the status goes `closed` (the pause). A visitor message cancels it
  (`cancelOn`) and `postChatMessage` flips `closed` back to `active`. If the contact has an email or phone, the pause
  hands over to `conversation/awaiting-reply` with `fromChat: true` (the days-long cadence otherwise stops on
  `closed`); a chat visitor with a phone but no email is then texted (`smsWanted` in `qualifier/tools.ts`).
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

**No-reply fallback.** `reply-watchdog` also reacts to `conversation/message.received`:
sleeps `NO_REPLY_AFTER` (`lib/qualifier/unanswered.ts`: 5 minutes, 30s under
`CADENCE_FAST`), then `checkUnanswered` (`watchdog.ts`) — if the lead is still
new / active and no outbound message followed their latest inbound, it marks the
conversation `handed_off` and posts "Lead needs a person: who, why, how to reach
them" to the org's Slack (`notifyUnansweredLead`). `qualify-conversation` calls the
same notifier at once when it skips for `disabled`, `over-allowance` or
`suppressed`. One alert per lead: already handed-off / booked / closed leads are left
alone.

**Other functions.** `psa-writeback` (see PSA write-back) and `speed-to-lead-watch`
(cron, 13:00 UTC daily: `funnelByOrg(1)` from `@alevo/db` → `slowOrgs` /
`speedDigest` in `lib/alerts/speed-digest.ts` → `notifyInternal`, Alevo's own
Slack webhook saved under Admin → Settings → Internal alerts (`platform_secrets`);
silent when every org is on target or nothing is saved).

## Dashboard

**Boards restyle (Dashboard, Conversations, Client, Thread):** page-local pieces live in `components/conversations/kit.tsx` (`Panel`, `Strip`, `TabLinks`, `Kpi` with a coloured "▲/▼ n vs prior" line, `FitMeter`, `FitCard`, `ChannelIcons`, `StatusIcon`) and `refresh-button.tsx`. Dashboard: info strip, a blue "Getting started" note that opens the checklist panel (`getting-started.tsx`), tiles with prior-period deltas (`windowSql` in `lib/dashboard/window-sql.ts` gives the window / prior bounds and `ago()`), speed card as a bar against 60s. `/conversations` takes `?window=`, `?status=open|handed_off|booked|disqualified`, `?q=`; `lib/clients/overview.ts` feeds its tiles/charts, `clientTabCounts` the tab counts. Client page tabs are `?tab=overview|conversations|calls|meetings|psa`.

`(app)/dashboard/page.tsx` follows the Claude Design mockup row for row. One **time
window** for the whole APP, not per page: the "Last:" menu saves the choice in the `alevo_window` cookie (`lib/dashboard/window-cookie.ts`; server read `readWindow()` in `window-pref.ts`, default 7) and refreshes, so Dashboard, Conversations and Meetings always show the same window until it is changed (a `?window=` in the URL is ignored in the app; the admin console still uses the param). Values 1|7|30|90; the shared `WindowSwitch` in `@alevo/ui` is a "Last:" dropdown with Alt+1…4 shortcuts; helpers in
`lib/dashboard/window.ts`, tested): Today (1) buckets per hour (24 bars), 7 and 30 days per day, 90 per week (13
bars), all as calendar days in the org timezone computed in SQL. Rows: the four
`StatTile`s (`kpi-tiles.tsx`) → **Leads per day** (area chart) + **Speed to lead**
(`speed-card.tsx`: p50 / p95 of `first_reply_sent_at − lead_received_at` over
answered leads, a violet sparkline of the median per bucket, a pill against the 60s
target) → **Meetings booked** (columns) + **Where leads come from** (donut) + **Plan
usage** (`usage-meter.tsx`, always the billing month) → **Live activity**
(`auto-refresh.tsx` re-fetches every 30s while visible). `trend-chart.tsx` is the one
chart primitive (`kind="area" | "columns"`, hover + keyboard tooltip, peak label,
sr-only table, `width` ≈ the card's px so labels stay readable; axis labels thin out
via `labelStep` / `showLabel`). Charts are inline SVG on the tokens — no chart library.

**Every chart has a hover / focus tooltip** — `ChartTooltip` (`@alevo/ui/chart-tooltip`):
value bold, label muted, optional detail line and a stroke swatch; positioned by the
mark's fractional x / y inside a `relative` box so it scales with the SVG and flips
its anchor near the edges (never wraps, never leaves the card). Wired into the trend
chart (on the point, with "Up 2 from Oct 23" via `periodDelta`), the stat tiles'
mini bars (`@alevo/ui/mini-bars`, pass `seriesLabels` + `unit`; without labels bars
say "3 days ago"), the speed sparkline (`speed-sparkline.tsx`, crosshair + dot, "no
replies" for gaps; a dot on every reply day, solid line between adjacent ones, dashed
across quiet days) and the source donut (segment lifts, centre swaps to the channel,
legend rows hover too). Hit targets are whole bands / columns, keyboard focusable,
each with an `aria-label` + `role="img"`. A new chart uses the same primitive.

The super-admin console (`apps/admin`, `/dashboard`) shows the same funnel across
every org (`funnelByOrg(days)` in `packages/db/src/metrics.ts`, service path, clock
read in SQL) with the same 7 / 30 / 90 switch, p95 flagged over 60s. Dev data for
both: `supabase/seed-dev-dashboard.sql`. Its lists are one page each (busiest 25 in the
funnel, newest 25 orgs, newest 10 audit rows) with a "View all" footer into
`/organizations` and `/activity`, which page through the rest (`lib/orgs.ts`,
`lib/activity.ts`; shared tables in `components/`).

## Pagination (every list that can grow)

Rule: a page never reads more than `PAGE_SIZE` (25) rows of a list, and a dashboard
card shows one page with a link to the dedicated page rather than paging in place
(so flipping a page does not re-run every other query on the screen). No infinite
scroll. Keyset, not OFFSET: `packages/db/src/paginate.ts` exports `parseCursor`
(from `?cursor=`), `keysetWhere(table, { at, id }, cursor)` (anchor row looked up in
SQL, so microsecond timestamps compare exactly; `and()` it with the tenant scope),
`keysetOrder` and `finishPage(rows, cursor)` (fetch `PAGE_SIZE + 1`, get `rows` plus
`newer` / `older` cursors). `Pager` + `cursorHref` (`@alevo/ui/pager`) render
Previous / Next as links in a `CardFooter` reading "Page 3 of 12" (the page number
rides in the cursor — `older.<id>.<page>` — and `pages` = `pageCount(total)`; a stale
cursor says "This page is empty … Go to page 1"); any count the header needs is its own
aggregate query. Paged today: Conversations, Meetings (sorted by
`coalesce(start_at, created_at)`, figures from a filtered-count query), admin
Organizations and Activity. Knowledge documents and members are bounded (plan
limits, Clerk's 20 seats) and stay unpaged. Tests: `tests/pagination.test.ts` (pure)
and `tests/pagination-db.test.ts` (real walk over `audit_log`).

## Plan limits (usage allowances)

Agreed policy (plan.md §6, 2026-10-27): **nothing is billed automatically.** At 80% of
any allowance the owners/admins get a Slack + email heads-up; at 100% the metered
activity PAUSES and they are asked to upgrade (pricing page). Opt-in overage with a
monthly cap at published rates ($0.75 / conversation, $0.40 / voice minute, $0.03 /
prospecting email) lands with Stripe — the legal pages already describe both behaviours.

- `lib/usage/levels.ts` — pure math (`usageLevel`, `crossedThreshold`, `pct`, labels;
  tested in `tests/usage-limits.test.ts`). `lib/usage/limits.ts` — I/O: `meterUsage`
  (replaces direct `recordUsage` calls: records, then alerts once on the increment that
  crosses 80% / 100%) and `overAllowance(orgId, metric)` (the gate). `@alevo/db`
  exposes `recordUsage` (returns the new total), `getUsage(orgId)` (service path) and
  `currentPeriod`. `lib/usage/current.ts` is the RLS, per-request-cached read for the
  shell.
- **Gates:** `loadQualifierContext` skips `over-allowance` on `inbound_conversations`
  (the lead stays in the inbox for a person); the Vapi `assistant-request` answers a
  spoken "can't take calls right now" when `voice_minutes` is used up. Form / SMS /
  voice still RECORD the conversation and consent — only the agent's work pauses.
- **Shell:** `components/usage-banner.tsx` in `(app)/layout.tsx` — silent below 80%,
  warning notice from 80%, danger once paused. Never a toast.
- An allowance of 0 means "not metered" (ok), so Starter's 0 outbound dials never
  blocks anything.

## PSA write-back (ConnectWise Manage)

Plan.md Sprint 5. A lead reaches the PSA when it becomes **qualified** in the
dashboard's sense — handed to a person, or a meeting booked — never on a score alone.

- **Connect** (Workspace → Integrations → ConnectWise, `connectwise-form.tsx`, one
  Save): API site (host only, `normalizeSite`), login company ID and the API member
  identifier on `org_profiles`; public / private keys in `org_secrets`. Connected =
  all five present (`connectwiseMissing` in `lib/psa/connectwise-map.ts`); anything
  less shows Needs setup with what's missing. "Test connection" (`testConnectWise`)
  pings `/system/info` and checks the member exists. The platform developer client
  ID is `CONNECTWISE_CLIENT_ID` (env; sent as the `clientId` header).
- **Trigger**: `requestPsaWriteback(orgId, conversationId, "handed_off" | "booked")`
  (`lib/psa/request.ts`) sends `psa/writeback.requested` from the Qualifier tools
  (`set_status` handed_off, `escalate_to_human`, `book_meeting`), the voice tools,
  and the Cal.com / Calendly booking webhooks. Best-effort, never fails the caller.
- **Function** `psa-writeback` (per-org concurrency 1, throttled, 3 retries):
  `load` → `company` → `contact` → `activity-<reason>` → `opportunity` (booked
  only). Each `ensure*` in `lib/psa/writeback.ts` checks `psa_links`, then Manage's
  own search, then creates — so a replay never duplicates. Step results are ids
  only: the client is rebuilt inside every step (`loadConnectWise`), keys never
  leave the server or land in Inngest.
- **Mapping** (`connectwise-map.ts`, tested): company = what the lead typed, else
  their work-email domain, else their name; identifier = upper-case alnum ≤25;
  contact by email (`childConditions=communicationItems/value=`); activity name
  ≤100 chars + notes with score / reasons / meeting / deep link; opportunity
  "Company — inbound via Alevo (Name)" assigned to the member. Creates look up the
  instance's default company status / type and activity type / status (`defaultFlag`)
  and send them when present.
- **UI**: the conversation page lists what was written ("In ConnectWise",
  `psa-panel.tsx`) from `psa_links` with an explicit org filter.
- Not built: updates after creation (status changes, notes appended), HaloPSA,
  CRMs, plan gating on `plans.psa_integrations`.

## Contacts, clients and calls

Sprint 7.2 (spec `docs/superpowers/specs/2026-11-02-clients-and-calls-design.md`).

- **One contact per person and org.** `resolveContact(orgId, { email, phone }, fields)` and
  `claimIdentity(orgId, contactId, { email, phone })` in `@alevo/db` (`packages/db/src/crm/`)
  own contact identity: `normalizeEmail` / `normalizePhone` (10 digits → `+1…`), lookup by
  either key, fill-only-empty (a `form` touch may overwrite name/company), and a **merge**
  when a touch proves two rows are one person — the OLDER row keeps its id, conversations /
  consents / meetings / calls move, the loser is deleted, `contact.merged` is audited
  (`target` = loser, `metadata.into` = keeper). Partial unique indexes on `(org_id,
  lower(email))` and `(org_id, phone)` enforce it; a racing insert re-reads. The form, SMS and
  voice entry points call `resolveContact`; chat still inserts an anonymous contact and the
  agent's `save_contact_details` (`lib/contact-details.ts`) goes through `claimIdentity` and
  returns `{ saved, contactId }` — the voice and Qualifier tool contexts replace their
  `contactId` with the survivor, because a `book_meeting` in the same batch must land on it.
- **One conversation per call.** `callThread(orgId, callRef, phone)` (`lib/voice/contact.ts`)
  keys a `voice` conversation and a `calls` stub on Vapi's call id; every `tool-calls` and the
  `end-of-call-report` resolve through it, so the next call is a new thread. `recordCall(data,
  recordingKey, summary?)` UPDATES the stub (`ended_at is null` = first report; a replay is a
  no-op) and no longer writes a summary message. A withheld number gets an anonymous voice
  contact. Summary: `analysisPlan.summaryPlan` with `CALL_SUMMARY_PROMPT`
  (`lib/voice/summary-prompt.ts`); when the report has none and there is a transcript,
  `process-voice-call` runs `summarizeCall` (`lib/qualifier/summarize-call.ts`) as its own step.
  The thread renders calls as `CallCard` (`components/conversations/call-card.tsx`: duration,
  `CALL_OUTCOME` pill, summary, transcript, **Play recording** via the `recordingUrl` server
  action — admin+, presigned R2 GET, 10 minutes).
- **Clients list.** `/conversations` is one row per contact, most recent first, keyset on
  `contacts.last_activity_at` (kept by the 0038 insert triggers; the one app-side write is a
  merge, which carries the loser's newest activity onto the keeper). Row facts come
  from correlated subqueries in `lib/clients/queries.ts` (`clientsPage(tx, orgId, cursor)`,
  `clientCount`); the client page `/conversations/client/[contactId]` reads
  `clientDetail(tx, orgId, contactId)` (`lib/clients/detail.ts`). Both take the org id
  explicitly (platform admins bypass RLS). The thread's name links to the client page and the
  aside says "N other conversations".
  **List tools:** Export (`conversations/export/route.ts`, viewer+, same tab/search, 5,000-row cap; `lib/clients/csv.ts` quotes and prefixes an apostrophe on cells starting `= + - @`), a Columns menu and sortable headers (`components/conversations/clients-panel.tsx`; the choice lives in localStorage, sorting reorders only the loaded page, paging stays keyset by activity; pure helpers in `lib/clients/list-view.ts`).
  **Thread / client actions** (`conversations/[id]/status-actions.ts`, UI `thread-actions.tsx`): hand off (rep+: status handed_off, `notifyHandoff` from the Qualifier tools once, PSA write-back, no repeat alert), mark not a fit (rep+; the cadence only works new/active threads), delete (admin+: messages + calls through the service path, org-scoped; recordings in R2 are left), and on the client page mark all open conversations not a fit. Each writes an audit entry. The thread has Calls / Meetings tabs (`?tab=`); the client Meetings tab reuses the Meetings page's `OutcomeControls` / `ManageControls`.
- Tests: `tests/identity.test.ts`, `resolve-contact-db`, `contact-details-db`, `call-thread-db`,
  `call-summary`, `format`, `client-activity-db`, `clients-query-db`. Vitest aliases
  `server-only` to a stub and `@` to the app root (`vitest.config.ts`).

## Platform-admin bootstrap

There is no UI to grant super-admin. After signing in once (so the Clerk webhook
mirrors your user), promote yourself:

```sql
update public.users set is_platform_admin = true where email = '<you>@example.com';
```

`supabase/seed.sql` does this for the builder on `supabase db reset`.

## Admin provisioning + Getting started

Sprint 6. Alevo creates client workspaces from the console (Admin → Organizations →
New organization: Clerk org with the admin as creator + owner invite + plan) and sets
them up in THIS app. **Support rule:** a platform admin's membership in an org is
`support` by default (`lib/webhooks/membership-role.ts`, set by the webhook mirror): app role
`admin`, never owner, no seat. It is a per-workspace CHOICE: an explicit invite role makes them a real member with that role, and Admin → Organizations → [org] → Members has "Make owner" / "Back to support" on every platform admin's row (`setMemberMode`, audited `membership.made_owner` / `made_support`); the mirror never reverts a real membership of a platform admin. A platform admin who is also an owner counts as a seat and receives owner emails; excluded from seats and from `ownerEmails`; the Members tab shows
"Alevo support" with no role select / Remove and the members actions refuse to touch
them (`lib/members/guards.ts`). **Readiness** lives in `@alevo/db`
(`packages/db/src/onboarding/`: pure `readiness()` over `loadReadinessFacts(orgId)`,
nine items) and feeds both the console's Setup card and the dashboard's **Getting
started** card (`dashboard/getting-started.tsx`, owners/admins only, gone when
`isReady`). Booking / phone / Slack can be declined (`declineSetupItem` → `setSetupDecline`,
keys in `DECLINE_KEYS`); choosing a tool, setting a number or saving a webhook clears the flag. **Deep links** from the console hit
`app/admin/open/page.tsx` (`?org=<clerkOrgId>&to=/workspace/…`): platform admin +
member → client-side `setActive` then a full navigation to `to`
(`lib/admin/destination.ts` allowlist, else `/dashboard`); not a member → back to the
console (`NEXT_PUBLIC_ADMIN_URL`) with "Join as support first". Explicit-org Clerk
wrappers (`createOrganizationAs`, `inviteToOrg`, `addMemberToOrg`, `removeFromOrg`,
`revokeOrgInvitation`) sit beside the active-org ones in `@alevo/auth`.

## Local dev

Dev runs against a **cloud Supabase dev project** (separate from staging/prod) —
Docker is not used (Docker Desktop on Windows Home needs WSL2). Apply migrations
over the network; no local Postgres required.

```bash
npx supabase link --project-ref <dev-ref>   # one-time; prompts for DB password
npx supabase db push --remote               # apply supabase/migrations/* to the cloud DB (CLI 3 defaults to a local stack)
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

## Vendor calls (timeouts + retries)

Every raw HTTP call to a vendor goes through `vendorFetch` (`lib/http/vendor-fetch.ts`;
rules in `retry.ts`, tested): a 15s timeout per attempt (ConnectWise / URL extraction
20s) and up to 2 retries with exponential backoff + jitter, honouring `Retry-After`
(capped at 10s). What retries: 429 / 502 / 503 / 504 for any request; timeouts, network
drops, 500 / 408 / 425 only when the request is **idempotent** (GET / PUT / DELETE by
default; a POST opts in with `{ idempotent: true }` — Google free/busy and Graph
getSchedule are reads, Graph event creation dedupes on `transactionId`, Voyage
embeddings are a pure function of their input). A timed-out POST is never replayed
(it may have landed). Callers keep their own `res.ok` handling and vendor-specific
cases (Twilio 21610, Google 410, Graph 404). SDK clients bound themselves: Anthropic
`timeout: 90_000, maxRetries: 2` (`lib/qualifier/run.ts`), aws4fetch retries R2 on
its own, Resend sends are best-effort and logged. Inngest step retries sit above all
of this for background work. Never call `fetch` on a vendor directly.

## Observability

Sentry is wired (`instrumentation.ts`, `sentry.*.config.ts`,
`instrumentation-client.ts`) and is a no-op until `NEXT_PUBLIC_SENTRY_DSN` is
set. Source-map upload (withSentryConfig) is intentionally not enabled yet.

- **Support button** (an icon in the top bar, beside the avatar: `components/support/support-button.tsx`): any signed-in member reports a problem (what it is, what happened, optional steps, up to 3 screenshots; choose or paste; compressed in the browser to JPEG ≤1600px). `sendSupportReport` (`components/support/actions.ts`) checks it (`lib/support/report.ts`, tested), rate limits 5 per user per hour, stores each screenshot in R2 under `organizations/{orgId}/support/` (purpose `support`), and posts a Slack Block Kit message (`postInternal` in `lib/alerts/internal.ts`) to **Alevo's own webhook** saved under Admin console → Settings → Internal alerts, never to the workspace's Slack. The message carries the person, role, workspace, page (no query string), browser and window size (from the session / browser, not typed), the text, and each screenshot as a preview plus a 7-day presigned link. Typed text is Slack-escaped. `next.config.ts` raises the server-action body limit to 8mb for it. Screenshots are not deleted afterwards.

- **Settings and gear icons**: the sidebar bottom has a Preferences link to `/preferences` (theme + plan; not `/settings`, which `next.config.ts` redirects permanently to `/workspace`). "Manage" buttons are the gear icon with an `sr-only` name, never the word.

- **Workspace boards (Profile v2 / Agent / Knowledge, 2026-11-13):** `components/workspace/` holds `panel-row.tsx` (dense label/control row), `save-bar.tsx` (full-width bottom bar, shown only while dirty) and `status-strip.tsx` (the board's info strip from `org_profiles`). **Profile** is the v2 layout (`profile-field.tsx` underline fields with counters, `profile-toc.tsx` on-this-page list). **Agent** is ONE form (`agent-ui.tsx` + `save-all.ts` `saveAgentPage`: agent half then booking half; the booking switch posts `bookingEnabled`), sub-tabs General / Booking / Channels / Notifications via `SubTabs`; panels stay mounted and a `#booking` / `#channels` hash opens its tab. On/off switches sit in a row (board), no longer in `CardHeader`. **Knowledge** is a toolbar (Add text / Add URL dialogs, Upload PDF) over a documents table with a client filter.
