# Admin provisioning + onboarding checklist — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A platform admin creates a client workspace from the console, invites its owner, sets it up in the app as a flagged "Alevo support" member, and both the console and the client dashboard show one readiness checklist until the workspace is ready.

**Architecture:** Clerk stays the source of orgs and memberships; two explicit-org wrappers in `@alevo/auth` let the console act on an org that is not the session's active one. The webhook mirror flags every platform admin's membership as `support`. A pure `readiness()` function in `@alevo/db` turns loaded facts into nine checklist items; the admin org page and the dashboard card both render it. Deep links from the console land on a tiny app page that activates the org client-side.

**Tech Stack:** Next.js 16 App Router, React 19 `useActionState`, Clerk v7 backend SDK (`@clerk/backend` 3.26), Drizzle + postgres-js, Supabase SQL migrations, Vitest (apps/app), Tailwind 4 with `@alevo/ui`.

**Spec:** `docs/superpowers/specs/2026-11-02-admin-provisioning-onboarding-design.md`

## Global Constraints

- **No commits.** The user commits on request only. Plan steps end at "verify", never at `git commit`.
- Migration file is `supabase/migrations/0030_support_membership.sql`; apply with `pnpm db:push:dev:dry` then `pnpm db:push:dev` (run from the repo root).
- Clerk backend calls live only in `packages/auth/src/org-admin.ts` (rule 3). Authorization (`requirePlatformAdmin` / `requireRole`) is done by the calling server action.
- Custom components only: `Dialog`, `Select`, `ConfirmSubmit`, `Notice`, `Pill`, `Field` from `@alevo/ui` (admin) or `@/components/ui/*` (app). Forms are `noValidate` with per-field errors; no `alert`/`confirm`.
- Platform admins bypass RLS: every org-scoped read in this plan filters on an explicit `orgId` (service path) or `app.current_org_id()` (app path).
- Never `prettier --write`. Match the file's existing line width (120–160 cols) by hand.
- Copy fixed by the spec: support rows read **"Alevo support"**; the support rule is **any platform admin's membership in any org is support**; support members hold app role **`admin`**; checklist items and their `href`s are the table in spec §3; the two decline flags are `booking_declined` and `phone_declined`; the client card is titled **"Getting started"**; the console card is titled **"Setup"** with header **"N of 9 done"** / **"Ready"**.
- Before Task 7 the user confirms in the Clerk dashboard that the plan allows backend organization creation and enough members per org (client seats + one support member per org). Report what they find in the final summary; do not block on it.
- Tests run with `pnpm --filter @alevo/app test` (DB tests need `apps/app/.env.local` `DATABASE_URL`). Typecheck: `pnpm --filter @alevo/app typecheck` and `pnpm --filter @alevo/admin typecheck`. Lint: `pnpm --filter @alevo/app lint`, `pnpm --filter @alevo/admin lint`.

## Review Focus

1. A platform admin who signs up a *self-serve* workspace of their own (creator, no invite) must not be made `support`/`admin` by accident and left with no owner → Task 2 test "creator who is a platform admin": we accept the rule (support, admin role) and the test pins it, so nobody "fixes" it silently.
2. The owner invite accepted *before* `organizationMembership.created` arrives (webhook ordering): `applyPendingInviteRole` still marks the invite accepted and the readiness "owner" item must flip → Task 4 test `ownerAccepted` from an accepted invite with no owner membership yet.
3. `to` in the deep link must never redirect off-site or to an API path → Task 9 test of `allowedDestination()` with `https://evil.example`, `//evil.example`, `/api/webhooks/clerk`, `/workspace/../admin`.
4. Removing the last real owner must stay blocked even when a support admin is present (support rows are not owners) → Task 3: the guard counts `role = owner and not support`; the existing "last owner" tests of the actions do not exist, so the plan adds the assertion to the pure `canRemove()` helper test.
5. `plans` with `is_active = false` must not be offered in the New organization dialog or the Plan card → Task 7/8 query `where(eq(plans.isActive, true))`; verified in the manual QA line.

---

### Task 1: Migration 0030 + schema columns

**Files:**
- Create: `supabase/migrations/0030_support_membership.sql`
- Modify: `packages/db/src/schema/identity.ts` (memberships), `packages/db/src/schema/org-profiles.ts`

**Interfaces:**
- Produces: `memberships.support: boolean not null default false`; `orgProfiles.bookingDeclined`, `orgProfiles.phoneDeclined`: `boolean not null default false`.

- [ ] **Step 1: Write the migration**

```sql
-- 0030 — Support memberships + setup declines.
-- A platform admin's membership in a client org is "support": no seat, no alert
-- emails, shown as "Alevo support", not removable by the client. Booking and
-- phone can be declined so the Getting started checklist completes without them.
alter table public.memberships add column support boolean not null default false;
alter table public.org_profiles
  add column booking_declined boolean not null default false,
  add column phone_declined   boolean not null default false;
update public.memberships m set support = true
  from public.users u where u.id = m.user_id and u.is_platform_admin;
```

- [ ] **Step 2: Mirror in Drizzle** — add `support: boolean("support").notNull().default(false)` to `memberships`; add `bookingDeclined: boolean("booking_declined").notNull().default(false)` and `phoneDeclined: boolean("phone_declined").notNull().default(false)` to `orgProfiles` (after `bookingTool`), each with a one-line comment naming migration 0030.

- [ ] **Step 3: Apply** — Run `pnpm db:push:dev:dry` (expect the single new file listed), then `pnpm db:push:dev`. Expected: "Finished supabase db push."

- [ ] **Step 4: Typecheck** — `pnpm --filter @alevo/db typecheck` passes.

---

### Task 2: Support flag in the mirror, `ownerEmails` moves to `@alevo/db`, seat counts

**Files:**
- Create: `apps/app/lib/webhooks/membership-role.ts`, `apps/app/tests/membership-role.test.ts`, `packages/db/src/onboarding/owner-emails.ts`
- Modify: `apps/app/lib/webhooks/clerk-mirror.ts` (`mirrorMembership`, `resolveRole`), `apps/app/lib/notifications/owner-emails.ts` (re-export), `packages/db/src/index.ts`, `apps/admin/lib/orgs.ts` (`memberCount`)

**Interfaces:**
- Produces: `membershipFor(input: { isPlatformAdmin: boolean; inviteRole: AppRole | null; clerkRole: string; isCreator: boolean }): { role: AppRole; support: boolean }` in `membership-role.ts` (pure; `resolveRole` moves here and becomes private).
- Produces: `ownerEmails(orgId: string): Promise<string[]>` exported from `@alevo/db` — owners + admins, `and not support`.

- [ ] **Step 1: Write the failing test** `apps/app/tests/membership-role.test.ts` (relative import `../lib/webhooks/membership-role`):

```ts
it("platform admin is support with the admin role, even as creator", () =>
  expect(membershipFor({ isPlatformAdmin: true, inviteRole: null, clerkRole: "org:admin", isCreator: true })).toEqual({ role: "admin", support: true }));
it("creator becomes owner", () =>
  expect(membershipFor({ isPlatformAdmin: false, inviteRole: null, clerkRole: "org:admin", isCreator: true })).toEqual({ role: "owner", support: false }));
it("invite role wins over the Clerk role", () =>
  expect(membershipFor({ isPlatformAdmin: false, inviteRole: "viewer", clerkRole: "org:admin", isCreator: false })).toEqual({ role: "viewer", support: false }));
it("org:admin without invite maps to admin, org:member to rep", () => { /* two expects */ });
```

- [ ] **Step 2: Run it, expect FAIL** — `pnpm --filter @alevo/app test -- membership-role` fails with "Cannot find module".

- [ ] **Step 3: Implement `membershipFor`** in `membership-role.ts`; move `resolveRole` out of `clerk-mirror.ts` into it.

- [ ] **Step 4: Use it in `mirrorMembership`** — the user upsert returns `isPlatformAdmin` as well as `id`; compute `const { role, support } = membershipFor({ isPlatformAdmin: user.isPlatformAdmin, inviteRole: await applyPendingInviteRole(...), clerkRole: data.role, isCreator })`; write `support` in both `values` and the conflict `set`.

- [ ] **Step 5: Move `ownerEmails`** — new `packages/db/src/onboarding/owner-emails.ts` (same body, `and(eq(memberships.orgId, orgId), inArray(memberships.role, ["owner","admin"]), eq(memberships.support, false))`, no `server-only` import); export from `packages/db/src/index.ts`; `apps/app/lib/notifications/owner-emails.ts` becomes `export { ownerEmails } from "@alevo/db";` (keep the `server-only` import).

- [ ] **Step 6: Seat count** — in `apps/admin/lib/orgs.ts` `orgQuery`, `memberCount: sql<number>\`count(distinct ${memberships.id}) filter (where not ${memberships.support})\`.mapWith(Number)`.

- [ ] **Step 7: DB check** `apps/app/tests/owner-emails-db.test.ts` (read-only, real DB like `pagination-db.test.ts`): for every org id in `memberships`, `ownerEmails(orgId)` contains no email belonging to a user with `is_platform_admin = true`. Skips (returns) when `DATABASE_URL` is unset.

- [ ] **Step 8: Verify** — both tests pass; `pnpm --filter @alevo/app typecheck`, `pnpm --filter @alevo/admin typecheck` clean.

---

### Task 3: Members tab shows "Alevo support"; actions refuse to touch support rows

**Files:**
- Create: `apps/app/lib/members/guards.ts`, `apps/app/tests/member-guards.test.ts`
- Modify: `apps/app/app/(app)/workspace/org-actions.ts` (`MemberView`, `loadMembers`), `apps/app/components/workspace/members-tab.tsx` (`MemberRow`), `apps/app/app/(app)/workspace/members/actions.ts` (`changeMemberRole`, `removeMember`)

**Interfaces:**
- Produces: `MemberView.support: boolean`.
- Produces: `canChangeRole(target: { role: AppRole; support: boolean }): string | null` and `canRemove(target: { role: AppRole; support: boolean }, otherOwners: number): string | null` in `guards.ts` — `null` means allowed, otherwise the error copy. Copy: `"Alevo support members are managed by Alevo."`, `"Cannot remove the last owner"`, `"Cannot demote the last owner"` (the existing strings).

- [ ] **Step 1: Failing test** `member-guards.test.ts`: support target → the Alevo copy from both guards; owner with `otherOwners = 0` → last-owner copy; rep → `null`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement the guards**, then call them: `changeMemberRole` selects `{ role, support }`, returns `{ error }` when `canChangeRole` is non-null (before the owner checks); `removeMember` counts other owners with `and(eq(role,"owner"), eq(support,false), ne(userId, target))` and uses `canRemove`.

- [ ] **Step 4: `loadMembers`** selects `support: memberships.support` and maps it onto `MemberView`.

- [ ] **Step 5: `MemberRow`** — when `member.support`: render `<Pill tone="muted">Alevo support</Pill>` in place of the role `Select`, and no remove form. Name column shows the person's name as before.

- [ ] **Step 6: Verify** — tests pass; app typecheck + lint clean; open Manage → Members in the browser with a support member present (Task 7 creates one) and see the pill, no Remove.

---

### Task 4: Readiness: pure function + loader in `@alevo/db`

**Files:**
- Create: `packages/db/src/onboarding/readiness.ts`, `packages/db/src/onboarding/load-readiness.ts`, `apps/app/tests/readiness.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces (produces):**

```ts
export type ReadinessKey = "owner" | "profile" | "knowledge" | "booking" | "phone" | "slack" | "alerts" | "agent" | "proven";
export type ReadinessFacts = {
  ownerAccepted: boolean;             // accepted owner invite OR a non-support owner membership
  companyName: string | null; offering: string | null; idealCustomer: string | null;
  readyDocs: number;                  // kb_documents with status 'ready'
  bookingTool: BookingProvider | null; bookingConfigured: boolean; bookingDeclined: boolean;
  smsFromNumber: string | null; phoneDeclined: boolean;
  slackSaved: boolean; slackVerified: boolean;
  emailAlerts: boolean; ownerEmailCount: number;
  agentOn: boolean;
  repliedConversations: number;       // conversations with first_reply_sent_at not null
};
export type ReadinessItem = { key: ReadinessKey; label: string; done: boolean; detail: string; href: string; declinable?: "booking" | "phone" };
export function readiness(f: ReadinessFacts): ReadinessItem[];   // always 9 items, spec §3 order
export function isReady(items: ReadinessItem[]): boolean;
export async function loadReadinessFacts(orgId: string): Promise<ReadinessFacts>; // withService, explicit orgId on every query
```

`href` values: owner/profile → `/workspace/profile`; knowledge → `/workspace/knowledge`; booking/phone/slack → `/workspace/integrations`; alerts/agent → `/workspace/agent`; proven → `/conversations`. Labels: "Owner joined", "Business profile", "Knowledge base", "Booking", "Phone", "Slack", "Email alerts", "Agent on", "First reply". `detail` is one short sentence per state (done vs missing), e.g. booking missing: `"Connect a booking tool, or mark it as not used."`; declined: `"Not using booking."`.

`bookingConfigured` (computed in the loader): `calcom` → secret `calcom_api_key` present and `calcomEventTypeId` set; `google`/`m365` → `calendarProvider === bookingTool` and `calendarId` set; `calendly` → `calendlyUrl` set. Secret presence via `listOrgSecretKeys(orgId)`.

- [ ] **Step 1: Failing test** `readiness.test.ts` (imports `readiness`, `isReady` from `@alevo/db`): a `BASE` facts object that is fully done → 9 items, all `done`, `isReady` true; each of these flips exactly one item to not-done: `ownerAccepted:false`, `idealCustomer:null`, `readyDocs:0`, `{bookingTool:null, bookingDeclined:false}`, `{smsFromNumber:null, phoneDeclined:false}`, `slackVerified:false`, `ownerEmailCount:0`, `agentOn:false`, `repliedConversations:0`; declines count as done: `{bookingTool:null, bookingDeclined:true}` and `{smsFromNumber:null, phoneDeclined:true}` → done; `bookingTool:"calcom", bookingConfigured:false` → not done. (Review Focus 2: `ownerAccepted` is one boolean, so an accepted invite with no membership yet is the loader's job: see Step 4.)

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `readiness` + `isReady`.**

- [ ] **Step 4: Implement `loadReadinessFacts`** — one `Promise.all` over: profile row; `count(*)` of `kbDocuments` where `status='ready'`; `listOrgSecretKeys`; `ownerEmails(orgId).length`; `count(*)` of `conversations` where `firstReplySentAt is not null`; `ownerAccepted = exists(orgInvitations where role='owner' and status='accepted') or exists(memberships where role='owner' and support=false)`. Export all three from `packages/db/src/index.ts`.

- [ ] **Step 5: Verify** — tests pass; `pnpm --filter @alevo/db typecheck` clean.

---

### Task 5: Explicit-org Clerk wrappers

**Files:**
- Modify: `packages/auth/src/org-admin.ts`, `packages/auth/src/index.ts`

**Interfaces (produces):**

```ts
export async function createOrganizationAs(p: { name: string; createdByClerkUserId: string }): Promise<{ clerkOrgId: string }>;
export async function inviteToOrg(p: { clerkOrgId: string; email: string; role: AppRole; inviterClerkUserId: string }): Promise<{ clerkInvitationId: string }>;
export async function addMemberToOrg(p: { clerkOrgId: string; clerkUserId: string; role: AppRole }): Promise<{ clerkMembershipId: string }>;
export async function removeFromOrg(p: { clerkOrgId: string; clerkUserId: string }): Promise<void>;
export async function revokeOrgInvitation(p: { clerkOrgId: string; clerkInvitationId: string; requestingClerkUserId: string }): Promise<void>;
```

- [ ] **Step 1: Implement** — `createOrganizationAs` → `client.organizations.createOrganization({ name, createdBy })`; `inviteToOrg` holds the body of today's `inviteToActiveOrg` (publicMetadata `alevoRole`, `redirectUrl` from `NEXT_PUBLIC_APP_URL`), and `inviteToActiveOrg` becomes a two-line call to it with the active context; `addMemberToOrg` → `createOrganizationMembership({ organizationId, userId, role: toClerkRole(role) })`; `removeFromOrg` → `deleteOrganizationMembership`; `revokeOrgInvitation` holds the body of `revokeActiveOrgInvitation`, which then calls it. Export the five from `index.ts`.

- [ ] **Step 2: Verify** — `pnpm --filter @alevo/auth typecheck`; app typecheck still clean (the invite action is unchanged from the outside).

---

### Task 6: `Select` moves to `@alevo/ui`

**Files:**
- Create: `packages/ui/src/select.tsx` (moved from `apps/app/components/ui/select.tsx`)
- Modify: `packages/ui/package.json` (`"./select": "./src/select.tsx"`), `apps/app/components/ui/select.tsx` (becomes `export { Select, type SelectOption } from "@alevo/ui/select";` with the "Shared with the admin console" comment the siblings carry)

- [ ] **Step 1: Move the file** — `git mv`; change `import { cx } from "@/lib/cx"` to `"./cx"`; `./field` import stays. Add the export line and the app re-export.

- [ ] **Step 2: Verify** — `pnpm --filter @alevo/ui typecheck`, app typecheck + lint clean; the Members tab role select still renders in the browser.

---

### Task 7: Console: "New organization"

**Files:**
- Create: `apps/admin/app/(admin)/organizations/actions.ts`, `apps/admin/app/(admin)/organizations/new-org-dialog.tsx`, `apps/admin/lib/plans.ts`
- Modify: `apps/admin/app/(admin)/organizations/page.tsx` (button in `PageHeader`), `apps/admin/components/orgs-table.tsx` (name cell is `<Link href={`/organizations/${o.id}`}>`)

**Interfaces:**
- Consumes: Task 5 wrappers; `recordAudit`; `requirePlatformAdmin()` (returns the user row with `id` and `clerkId`).
- Produces: `activePlans(): Promise<{ id: string; name: string; key: string }[]>` in `lib/plans.ts` (`where isActive`, order `sortOrder`).
- Produces: `export type NewOrgState = { ok?: boolean; error?: string; errors?: { name?: string; email?: string }; values?: { name: string; email: string; planId: string }; orgId?: string }` and `createOrganization(_prev: NewOrgState, formData: FormData): Promise<NewOrgState>`.
- Produces: `setOrgPlan(orgId: string, planId: string): Promise<void>` in `apps/admin/lib/subscriptions.ts` (its own `withService`) — insert `{ orgId, planId, status: "trialing" }` `onConflictDoUpdate({ target: orgSubscriptions.orgId, set: { planId, updatedAt } })`. (`org/provisioned` already uses `onConflictDoNothing`, so no change there.)
- Produces: `waitForMirroredOrg(clerkOrgId: string, ms = 5000): Promise<{ id: string } | null>` — poll `organizations.clerkId` every 250 ms.

- [ ] **Step 1: Implement `createOrganization`** — validate: name required (trim, ≤ 100 chars), email matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, planId in `activePlans()`; on field errors return `{ errors, values }`. Then: `createOrganizationAs` → `inviteToOrg({ role: "owner", inviterClerkUserId: me.clerkId })` → `waitForMirroredOrg` → if found: `setOrgPlan`, insert `orgInvitations` `{ orgId, email, role: "owner", status: "pending", clerkInvitationId, invitedBy: me.id }` `onConflictDoNothing` (the webhook may have mirrored it first), `recordAudit` `org.created_by_admin` `{ ownerEmail, planId }`; `revalidatePath("/organizations")`; return `{ ok: true, orgId }` (or `{ ok: true }` with `error: undefined` and a `notice` when the mirror did not arrive in time — add `notice?: string` to the state: `"Created. Mirroring from Clerk… refresh in a moment."`). Invite failure after creation → return `{ error: "Workspace created, but the invite failed: <message>. Resend it from the organization page.", orgId }`.

- [ ] **Step 2: Build `NewOrgDialog`** (client) — `Dialog` with `Field`s Name, Owner email, Plan (`Select` from `@alevo/ui/select`, default the plan whose `key === "starter"`), `noValidate`, per-field `FieldError`, `Notice tone="danger"` for `state.error`; on `state.ok && state.orgId` → `router.push(`/organizations/${orgId}`)`. The page renders `<NewOrgDialogButton plans={await activePlans()} />` in the header's action slot (a primary "New organization" button that opens the dialog).

- [ ] **Step 3: Verify in the browser** — create an org with your own second email: the row appears at the top of Organizations, Members = 0 (support not counted), plan as chosen; the owner's inbox gets the Clerk invite; admin typecheck + lint clean.

---

### Task 8: Console org page: Setup, Members, Plan, support actions

**Files:**
- Create: `apps/admin/app/(admin)/organizations/[id]/page.tsx`, `[id]/setup-card.tsx`, `[id]/org-actions-bar.tsx`, `[id]/plan-card.tsx`, `apps/admin/lib/org-detail.ts`
- Modify: `apps/admin/app/(admin)/organizations/actions.ts` (add the actions below)

**Interfaces:**
- Consumes: `loadReadinessFacts`, `readiness`, `isReady` (Task 4); `addMemberToOrg`, `removeFromOrg`, `inviteToOrg` (Task 5); `setOrgPlan`, `activePlans` (Task 7); `APP_URL` from `apps/admin/lib/app-url.ts`.
- Produces in `org-detail.ts`:

```ts
export type OrgDetail = { id: string; clerkId: string; name: string; createdAt: Date; planId: string | null; planName: string | null; status: string | null; agentOn: boolean;
  members: { userId: string; clerkUserId: string; name: string | null; email: string | null; role: AppRole; support: boolean }[];
  invites: { id: string; email: string; role: AppRole; status: InvitationStatus; clerkInvitationId: string | null }[] };
export async function orgDetail(id: string): Promise<OrgDetail | null>;
export function isMember(detail: OrgDetail, userId: string): boolean;
```

- Produces actions (all `requirePlatformAdmin`, all `recordAudit` with `actorUserId: me.id`, all `revalidatePath(`/organizations/${orgId}`)`), each `(_prev: OrgActionState, formData: FormData) => Promise<OrgActionState>` with `OrgActionState = { ok?: boolean; error?: string }` and the org id in a hidden `orgId` field:
  - `changePlan` (`planId`) → `setOrgPlan`; audit `plan.changed_by_admin`.
  - `joinAsSupport` → `addMemberToOrg({ clerkOrgId, clerkUserId: me.clerkId, role: "admin" })`; also upsert our `memberships` row `{ role: "admin", support: true, clerkMembershipId }` so the page updates before the webhook; audit `support.joined`.
  - `leaveWorkspace` → `removeFromOrg`; delete our row; audit `support.left`. Rendered behind `ConfirmSubmit` ("Leave this workspace?" / "You can join again from this page.").
  - `resendOwnerInvite` → `revokeOrgInvitation` on the pending owner invite if one exists, then `inviteToOrg` again; mark the old `orgInvitations` row revoked and insert the new one; audit `invite.resent`.
  - `setDecline` (`key: "booking" | "phone"`, `value: "true" | "false"`) → update `orgProfiles.bookingDeclined` / `phoneDeclined`; audit `setup.declined` / `setup.undeclined`.

- [ ] **Step 1: `org-detail.ts`** — one `withService` with three queries in `Promise.all` (org + plan + profile join; members join users; invitations). Return `null` when the org does not exist → page calls `notFound()`.

- [ ] **Step 2: Page** — `requirePlatformAdmin()` for `me`; `Promise.all([orgDetail(id), loadReadinessFacts(id), activePlans()])`. Layout: `PageHeader` (name; description: plan pill, status pill, `StatusDot` agent on/off, created `fmtWhen`), then `OrgActionsBar` (`Open in app` → `${APP_URL}/admin/open?org=${clerkId}&to=/dashboard`; `Join as support` or `Leave workspace`), then `SetupCard`, then Members `Table` (name, email, role pill, "Alevo support" pill for support rows) with pending invites beneath (status pill + "Resend owner invite" form when the owner item is not done), then `PlanCard`.

- [ ] **Step 3: `SetupCard`** — `CardHeader` title "Setup", hint `${done} of 9 done` or "Ready" when `isReady`. One row per item: `StatusDot` (`success` / `warning`), label, detail, right side: `Open` link to `${APP_URL}/admin/open?org=${clerkId}&to=${item.href}` and, when `item.declinable` and not done, a `setDecline` form button "Not using this"; when declined, "Using this after all" (value false).

- [ ] **Step 4: Verify in the browser** — the org from Task 7 shows "1 of 9 done" or similar; Join as support → Members shows you with the "Alevo support" pill; Leave → gone; Join again. Change plan → pill updates. Not using this on Phone → row green, header count +1. Resend owner invite → a second email arrives. Admin typecheck + lint clean.

---

### Task 9: App deep link `/admin/open`

**Files:**
- Create: `apps/app/app/admin/open/page.tsx`, `apps/app/app/admin/open/open-org.tsx`, `apps/app/lib/admin/destination.ts`, `apps/app/tests/destination.test.ts`

**Interfaces:**
- Produces: `allowedDestination(to: string | undefined): string` — returns `to` when it matches `/^\/(dashboard|conversations|meetings|workspace(\/[a-z-]+)?)$/`, otherwise `"/dashboard"`.

- [ ] **Step 1: Failing test** — `allowedDestination("/workspace/integrations") === "/workspace/integrations"`; `"https://evil.example"`, `"//evil.example"`, `"/api/webhooks/clerk"`, `"/workspace/../admin"`, `undefined` → `"/dashboard"`.

- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement.** **Step 4: Test passes.**

- [ ] **Step 5: Page** (server, `dynamic = "force-dynamic"`): `searchParams { org?: string; to?: string }`; `requirePlatformAdmin()` (non-admins hit `authInterrupt`); look up `organizations` by `clerkId = org` and the caller's `memberships` row via `withService`; no org → `notFound()`; no membership → `redirect(`${ADMIN_URL}/organizations/${orgId}?notice=join-first`)` where `ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://admin.getalevo.com"` (add to `apps/app/.env.example` with the dev value `http://localhost:3002`); otherwise render `<OpenOrg clerkOrgId={org} to={allowedDestination(to)} />`.

- [ ] **Step 6: `OpenOrg`** (client): `useOrganizationList({ userMemberships: { infinite: true } })` → on load, `setActive({ organization: clerkOrgId })` then `window.location.assign(to)` (full navigation so every server component re-reads the org, matching `WorkspaceSwitcher`). Shows a centered `Card` with `Spinner` "Opening workspace…" and a `Notice tone="danger"` if `setActive` throws.

- [ ] **Step 7: Console notice** — Task 8's page reads `searchParams.notice === "join-first"` and renders `Notice tone="warning"`: "Join as support first, then open the workspace."

- [ ] **Step 8: Verify** — from the console, Open on "Business profile" lands on Workspace → Profile with the client org active; without membership you land back on the console with the notice. App typecheck + lint + tests clean.

---

### Task 10: Client "Getting started" card + declines + clearing declines on connect

**Files:**
- Create: `apps/app/app/(app)/dashboard/getting-started.tsx`, `apps/app/app/(app)/dashboard/setup-actions.ts`
- Modify: `apps/app/app/(app)/dashboard/page.tsx`, `packages/auth/src/require-role.ts` + `index.ts` (export `getCurrentRole`), `apps/app/app/(app)/workspace/agent/booking-actions.ts` (where `bookingTool: tool` is written), `apps/app/app/(app)/workspace/agent/actions.ts` (where `smsFromNumber` is saved)

**Interfaces:**
- Produces: `getCurrentRole(): Promise<AppRole | null>` (the existing cached `currentRole`, exported under that name).
- Produces: `declineSetupItem(_prev: SetupState, formData: FormData): Promise<SetupState>` with fields `key` (`booking` | `phone`) and `value` (`true` | `false`); `requireRole("admin")`; writes the flag on the active org's profile via `withOrg` + `app.current_org_id()`; `recordAudit` `setup.declined` / `setup.undeclined`; `revalidatePath("/dashboard")`. `SetupState = { ok?: boolean; error?: string }`.

- [ ] **Step 1: Export `getCurrentRole`.**

- [ ] **Step 2: `declineSetupItem`** as specified.

- [ ] **Step 3: Clear on connect** — in `booking-actions.ts` where `bookingTool: tool` is set, also set `bookingDeclined: false`; in `agent/actions.ts` where the profile is saved with a non-null `smsFromNumber`, also set `phoneDeclined: false`.

- [ ] **Step 4: `GettingStarted`** (server component) — props `{ items: ReadinessItem[] }`; `Card` with `CardHeader` title "Getting started", hint `${done} of 9 done`; rows as in Task 8 Step 3 but `href` is the item's app path (`<Link>`), and the decline button is a tiny client form (`useActionState(declineSetupItem)`) rendered only for `declinable` items. Copy for the header hint when the owner has not joined yet is unchanged (the owner is the one reading it, so the item is already done for them in practice).

- [ ] **Step 5: Dashboard** — before the big `Promise.all`, `const [org, role] = await Promise.all([getCurrentOrg(), getCurrentRole()])` (both are `cache()`d, so the later `getCurrentOrg()` entry in the array is free; remove that entry and use `org`). Add `showSetup && loadReadinessFacts(org.id)` to the big `Promise.all` where `showSetup = org && (role === "admin" || role === "owner")`; derive `items = facts ? readiness(facts) : null`. Render `<GettingStarted items={items} />` between `PageHeader` and `KpiTiles` when `items && !isReady(items)`.

- [ ] **Step 6: Verify** — as the client owner the card shows with the missing items; click Not using this on Booking → row green; connect a booking tool → the declined flag clears (check `org_profiles.booking_declined` false); complete everything → the card disappears. As a rep the card never shows. App typecheck + lint + tests clean.

---

### Task 11: Docs + final verification

**Files:**
- Modify: `plan.md` (Sprint 6 header + items), `docs/manual-qa.md` (append section), `apps/app/CLAUDE.md` (schema list: `memberships.support`, declines; new section "Admin provisioning + Getting started" after "Platform-admin bootstrap"), `apps/admin/lib/*` have no CLAUDE.md so nothing there.

- [ ] **Step 1: `plan.md`** — retitle Sprint 6 to "Sprint 6 — Admin provisioning + onboarding checklist (built 2026-11-0X)"; check off: console New organization + owner invite; support membership; readiness checklist in console and dashboard; deep links; declines. Keep unchecked, moved under a "Later" sub-list: number provisioning, prospecting setup, guided Cal.com setup, "Test it" SMS/call. Update the header **Last updated** date and add one Progress sentence.

- [ ] **Step 2: `docs/manual-qa.md`** — append `# Admin provisioning + Getting started (2026-11-0X)` with checkboxes for: create org (fields, errors, inactive plans absent), owner invite email, Members = 0, org page 1-of-9, Join/Leave/Join, deep link with and without membership, Not using this both ways on both cards, Resend owner invite, owner accepts on another account and sees the Getting started card, Members tab shows "Alevo support" without Remove and the role select, owner/admin alert emails do not reach the support member, card disappears when complete, rep sees no card.

- [ ] **Step 3: `apps/app/CLAUDE.md`** — the new section (≤ 15 lines): the support rule, the readiness module path, the deep-link page and its allowlist, the decline flags.

- [ ] **Step 4: Final verification** — run all four: `pnpm --filter @alevo/app typecheck`, `pnpm --filter @alevo/admin typecheck`, `pnpm --filter @alevo/app lint`, `pnpm --filter @alevo/admin lint`, then `pnpm --filter @alevo/app test`. Expected: all clean, all tests pass (97 existing + the four new files). Report the Clerk plan-limit answer from Global Constraints in the summary.
